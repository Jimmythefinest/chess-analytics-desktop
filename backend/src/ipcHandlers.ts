import { getDb } from './db/init.js';
import { Chess } from 'chess.js';
import * as chesscom from './services/chesscom.js';
import * as lichess from './services/lichess.js';
import { parsePgn, extractOpeningInfo, classifyMove, generateSummary } from './services/analyzer.js';
import { analyzeGame } from './services/stockfish.js';
import type { Game, MoveAnalysis, InsightsOverview, OpeningStats } from './types.js';

/**
 * GAMES HANDLERS
 */

export async function importChessComGames(username: string, limit: number = 100) {
    const games = await chesscom.fetchAllGames(username, { limit });
    const db = getDb();

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO games 
        (id, source, pgn, white_player, black_player, user_color, result, time_control, opening_eco, opening_name, played_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    for (const game of games) {
        if (!game.pgn) continue;
        const gameId = chesscom.generateGameId(game);
        const result = chesscom.parseResult(game);
        const userColor = game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
        const { headers } = parsePgn(game.pgn);
        const opening = extractOpeningInfo(headers);

        const changes = insertStmt.run(
            gameId, 'chesscom', game.pgn, game.white.username, game.black.username,
            userColor, result, game.time_control, opening.eco, opening.name,
            new Date(game.end_time * 1000).toISOString()
        );
        if (changes.changes > 0) imported++;
    }

    return { success: true, imported, total: games.length };
}

export async function importLichessGames(username: string, limit: number = 100) {
    const games = await lichess.fetchGames(username, { limit });
    const db = getDb();

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO games 
        (id, source, pgn, white_player, black_player, user_color, result, time_control, opening_eco, opening_name, played_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    for (const game of games) {
        if (!game.pgn) continue;
        const gameId = lichess.generateGameId(game);
        const result = lichess.parseResult(game);
        const userColor = lichess.getPlayerName(game, 'white').toLowerCase() === username.toLowerCase() ? 'white' : 'black';

        const changes = insertStmt.run(
            gameId, 'lichess', game.pgn, lichess.getPlayerName(game, 'white'), lichess.getPlayerName(game, 'black'),
            userColor, result, lichess.getTimeControl(game), game.opening?.eco || '', game.opening?.name || '',
            new Date(game.createdAt).toISOString()
        );
        if (changes.changes > 0) imported++;
    }

    return { success: true, imported, total: games.length };
}

export async function listGames(query: any) {
    const { page = 1, limit = 20, source, opening, analyzed, result, sortBy = 'played_at', order = 'desc' } = query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (source) { whereClause += ' AND source = ?'; params.push(source); }
    if (opening) { whereClause += ' AND opening_eco LIKE ?'; params.push(`${opening}%`); }
    if (analyzed !== undefined && analyzed !== '') { whereClause += ' AND analyzed = ?'; params.push(analyzed === 'true' || analyzed === 1 ? 1 : 0); }
    if (result) { whereClause += ' AND result = ?'; params.push(result); }

    const validSortFields = ['played_at', 'opening_eco', 'result'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'played_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const countResult = db.prepare(`SELECT COUNT(*) as count FROM games ${whereClause}`).get(...params) as { count: number };
    const games = db.prepare(`
        SELECT id, source, white_player, black_player, user_color, result, 
               time_control, opening_eco, opening_name, played_at, analyzed
        FROM games ${whereClause}
        ORDER BY ${sortField} ${sortOrder}, id ASC
        LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    return {
        games,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total: countResult.count,
            pages: Math.ceil(countResult.count / Number(limit)),
        },
    };
}

export async function getGame(id: string) {
    const db = getDb();
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
    if (!game) throw new Error('Game not found');

    const analysis = db.prepare('SELECT * FROM analysis WHERE game_id = ? ORDER BY ply ASC').all(id) as MoveAnalysis[];
    const analyzed = analysis.length > 0;

    return {
        game,
        analyzed,
        analysis,
        hasAnalysis: analyzed,
        summary: analyzed ? generateSummary(analysis) : undefined,
    };
}

/**
 * ANALYSIS HANDLERS
 */

let analyzeAllProgress = {
    running: false,
    total: 0,
    completed: 0,
    analyzed: 0,
    failed: 0,
    currentGameId: '',
};

export async function triggerAnalysis(id: string, depth: number = 12) {
    const db = getDb();
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;
    if (!game) throw new Error('Game not found');

    const existingAnalysis = db.prepare('SELECT COUNT(*) as count FROM analysis WHERE game_id = ?').get(id) as { count: number };
    if (existingAnalysis.count > 0) return { success: true, message: 'Game already analyzed', alreadyAnalyzed: true };

    const analysisResults = await analyzeGame(game.pgn, game.user_color as 'white' | 'black', depth);
    const insertStmt = db.prepare(`
        INSERT INTO analysis 
        (game_id, move_number, ply, fen, move_played, best_move, eval_before, eval_after, cp_loss, classification, is_user_move)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const moves: MoveAnalysis[] = [];
    for (let i = 0; i < analysisResults.length; i++) {
        const current = analysisResults[i];
        const next = analysisResults[i + 1];
        let evalBefore = current.evaluation.type === 'mate' ? current.evaluation.value * 10000 : current.evaluation.value;
        let evalAfter = next ? (next.evaluation.type === 'mate' ? next.evaluation.value * 10000 : next.evaluation.value) : evalBefore;

        const isWhiteMove = current.ply % 2 === 1;
        let cpLoss = isWhiteMove ? evalBefore - evalAfter : evalAfter - evalBefore;
        cpLoss = Math.max(0, cpLoss);

        const isBestMove = current.movePlayedUci.toLowerCase().trim() === current.evaluation.bestMove.toLowerCase().trim();
        const classification = classifyMove(cpLoss, isBestMove, evalBefore, evalAfter, isWhiteMove);

        const moveAnalysis: MoveAnalysis = {
            game_id: id, move_number: current.moveNumber, ply: current.ply, fen: current.fen,
            move_played: current.movePlayed, best_move: current.evaluation.bestMove,
            eval_before: evalBefore, eval_after: evalAfter, cp_loss: cpLoss, classification,
            is_user_move: current.isUserMove,
        };
        moves.push(moveAnalysis);
        insertStmt.run(id, moveAnalysis.move_number, moveAnalysis.ply, moveAnalysis.fen, moveAnalysis.move_played, moveAnalysis.best_move, moveAnalysis.eval_before, moveAnalysis.eval_after, moveAnalysis.cp_loss, moveAnalysis.classification, moveAnalysis.is_user_move ? 1 : 0);
    }

    db.prepare('UPDATE games SET analyzed = 1 WHERE id = ?').run(id);
    const summary = generateSummary(moves);
    return { success: true, summary, movesAnalyzed: moves.length };
}

export async function triggerAnalysisForAll(depth: number = 12) {
    if (analyzeAllProgress.running) {
        return { success: false, alreadyRunning: true, ...analyzeAllProgress };
    }

    const db = getDb();
    const games = db.prepare(`
        SELECT id FROM games
        WHERE analyzed = 0
        ORDER BY played_at DESC, id ASC
    `).all() as Array<{ id: string }>;

    analyzeAllProgress = {
        running: true,
        total: games.length,
        completed: 0,
        analyzed: 0,
        failed: 0,
        currentGameId: '',
    };

    let analyzed = 0;
    const failed: Array<{ id: string; error: string }> = [];

    for (const game of games) {
        analyzeAllProgress.currentGameId = game.id;
        try {
            const result = await triggerAnalysis(game.id, depth);
            if (!result.alreadyAnalyzed) {
                analyzed++;
                analyzeAllProgress.analyzed = analyzed;
            }
        } catch (error: any) {
            failed.push({ id: game.id, error: error.message || String(error) });
            analyzeAllProgress.failed = failed.length;
        } finally {
            analyzeAllProgress.completed++;
        }
    }

    analyzeAllProgress.running = false;
    analyzeAllProgress.currentGameId = '';

    return {
        success: failed.length === 0,
        total: games.length,
        analyzed,
        failed,
    };
}

export function getAnalyzeAllProgress() {
    return analyzeAllProgress;
}

/**
 * INSIGHTS HANDLERS
 */

export async function getInsightsOverview() {
    const db = getDb();
    const gameStats = db.prepare('SELECT COUNT(*) as total, SUM(analyzed) as analyzed FROM games').get() as { total: number; analyzed: number };
    const winStats = db.prepare(`
        SELECT COUNT(*) as total,
        SUM(CASE WHEN (user_color = 'white' AND result = '1-0') OR (user_color = 'black' AND result = '0-1') THEN 1 ELSE 0 END) as wins
        FROM games
    `).get() as { total: number; wins: number };

    const winRate = winStats.total > 0 ? Math.round((winStats.wins / winStats.total) * 100) : 0;
    const blunderStats = db.prepare(`
        SELECT COUNT(*) as totalMoves, SUM(CASE WHEN classification = 'blunder' THEN 1 ELSE 0 END) as blunders,
        AVG(CASE WHEN is_user_move = 1 THEN cp_loss ELSE NULL END) as avgCpLoss
        FROM analysis WHERE is_user_move = 1
    `).get() as { totalMoves: number; blunders: number; avgCpLoss: number };

    const blunderRate = blunderStats.totalMoves > 0 ? Math.round((blunderStats.blunders / blunderStats.totalMoves) * 100 * 10) / 10 : 0;
    const topOpening = db.prepare(`
        SELECT opening_eco as eco, opening_name as name, COUNT(*) as count
        FROM games WHERE opening_eco != '' AND opening_eco IS NOT NULL
        GROUP BY opening_eco ORDER BY count DESC LIMIT 1
    `).get() as { eco: string; name: string; count: number } | undefined;

    const avgAccuracy = blunderStats.avgCpLoss ? Math.max(0, Math.min(100, 100 - (blunderStats.avgCpLoss / 10))) : 0;

    return {
        totalGames: gameStats.total,
        analyzedGames: gameStats.analyzed || 0,
        winRate,
        blunderRate,
        averageAccuracy: Math.round(avgAccuracy * 10) / 10,
        mostPlayedOpening: topOpening || { eco: 'N/A', name: 'No games', count: 0 },
        recentTrend: 'stable',
    };
}

export async function getOpeningsStats(minGames: number = 3) {
    const db = getDb();
    const openings = db.prepare(`
        SELECT g.opening_eco as eco, g.opening_name as name, COUNT(*) as gamesPlayed,
        SUM(CASE WHEN (g.user_color = 'white' AND g.result = '1-0') OR (g.user_color = 'black' AND g.result = '0-1') THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN (g.user_color = 'white' AND g.result = '0-1') OR (g.user_color = 'black' AND g.result = '1-0') THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
        FROM games g WHERE g.opening_eco != '' AND g.opening_eco IS NOT NULL
        GROUP BY g.opening_eco HAVING COUNT(*) >= ? ORDER BY gamesPlayed DESC
    `).all(minGames) as any[];

    const openingStats: OpeningStats[] = openings.map(o => {
        const blunderData = db.prepare(`
            SELECT AVG(blunderCount) as avgBlunders FROM (
                SELECT a.game_id, COUNT(*) as blunderCount FROM analysis a JOIN games g ON a.game_id = g.id
                WHERE g.opening_eco = ? AND a.classification = 'blunder' AND a.is_user_move = 1 GROUP BY a.game_id
            )
        `).get(o.eco) as { avgBlunders: number } | undefined;

        return {
            eco: o.eco, name: o.name, gamesPlayed: o.gamesPlayed,
            wins: o.wins, losses: o.losses, draws: o.draws,
            avgBlunders: blunderData?.avgBlunders ? Math.round(blunderData.avgBlunders * 10) / 10 : 0,
            winRate: Math.round((o.wins / o.gamesPlayed) * 100),
        };
    });

    return { openings: openingStats, total: openingStats.length };
}

export async function getBlundersInsights() {
    const db = getDb();
    const phaseBlunders = db.prepare(`
        SELECT CASE WHEN move_number <= 10 THEN 'opening' WHEN move_number <= 25 THEN 'middlegame' ELSE 'endgame' END as phase,
        COUNT(*) as count FROM analysis WHERE classification = 'blunder' AND is_user_move = 1 GROUP BY phase
    `).all() as { phase: string; count: number }[];

    const blunderOpenings = db.prepare(`
        SELECT g.opening_eco as eco, g.opening_name as name, COUNT(*) as blunders
        FROM analysis a JOIN games g ON a.game_id = g.id
        WHERE a.classification = 'blunder' AND a.is_user_move = 1 GROUP BY g.opening_eco ORDER BY blunders DESC LIMIT 10
    `).all();

    const monthlyTrend = db.prepare(`
        SELECT strftime('%Y-%m', g.played_at) as month, COUNT(*) as gameCount,
        SUM(CASE WHEN a.classification = 'blunder' AND a.is_user_move = 1 THEN 1 ELSE 0 END) as blunders
        FROM games g LEFT JOIN analysis a ON g.id = a.game_id WHERE g.analyzed = 1 GROUP BY month ORDER BY month DESC LIMIT 12
    `).all();

    return { byPhase: phaseBlunders, byOpening: blunderOpenings, monthlyTrend };
}

export async function getProgressInsights() {
    const db = getDb();
    const monthlyPerformance = db.prepare(`
        SELECT strftime('%Y-%m', played_at) as month, COUNT(*) as games,
        SUM(CASE WHEN (user_color = 'white' AND result = '1-0') OR (user_color = 'black' AND result = '0-1') THEN 1 ELSE 0 END) as wins
        FROM games GROUP BY month ORDER BY month DESC LIMIT 12
    `).all() as { month: string; games: number; wins: number }[];

    return {
        monthlyPerformance: monthlyPerformance.map(m => ({
            ...m,
            winRate: m.games > 0 ? Math.round((m.wins / m.games) * 100) : 0,
        })).reverse()
    };
}

function getTimeBucket(timeControl: string): string {
    const baseSeconds = Number(String(timeControl || '').split('+')[0]);
    if (!Number.isFinite(baseSeconds) || baseSeconds <= 0) return 'Unknown';
    if (baseSeconds < 180) return 'Bullet';
    if (baseSeconds < 600) return 'Blitz';
    if (baseSeconds < 1800) return 'Rapid';
    return 'Classical';
}

function pieceFromSan(move: string): string {
    const first = String(move || '').replace(/[+#?!x=]/g, '').trim()[0];
    const pieces: Record<string, string> = {
        K: 'King',
        Q: 'Queen',
        R: 'Rook',
        B: 'Bishop',
        N: 'Knight',
    };
    return pieces[first] || 'Pawn';
}

function pieceFromBestMove(fen: string, bestMove: string): string {
    const from = String(bestMove || '').slice(0, 2);
    if (!/^[a-h][1-8]$/.test(from)) return 'Unknown';

    try {
        const chess = new Chess(fen);
        const piece = chess.get(from as any);
        const pieces: Record<string, string> = {
            k: 'King',
            q: 'Queen',
            r: 'Rook',
            b: 'Bishop',
            n: 'Knight',
            p: 'Pawn',
        };
        return piece ? pieces[piece.type] : 'Unknown';
    } catch {
        return 'Unknown';
    }
}

function accuracyFromCpLoss(avgCpLoss: number): number {
    return Math.max(0, Math.min(100, Math.round((100 - (avgCpLoss / 10)) * 10) / 10));
}

function normalizeFen(fen: string): string {
    if (!fen || fen === 'start') {
        return new Chess().fen().split(' ').slice(0, 4).join(' ');
    }
    return fen.split(' ').slice(0, 4).join(' ');
}

function displayFen(fen: string): string {
    return (!fen || fen === 'start') ? new Chess().fen() : fen;
}

function isUserWin(game: Game): boolean {
    return (game.user_color === 'white' && game.result === '1-0') ||
        (game.user_color === 'black' && game.result === '0-1');
}

function isUserLoss(game: Game): boolean {
    return (game.user_color === 'white' && game.result === '0-1') ||
        (game.user_color === 'black' && game.result === '1-0');
}

export async function getExplorerPosition(fen: string = 'start') {
    const db = getDb();
    const targetFen = displayFen(fen);
    const targetKey = normalizeFen(targetFen);
    const targetPosition = new Chess(targetFen);
    const games = db.prepare(`
        SELECT id, pgn, result, user_color
        FROM games
        WHERE pgn != '' AND pgn IS NOT NULL
    `).all() as Array<Pick<Game, 'id' | 'pgn' | 'result' | 'user_color'>>;

    const moves = new Map<string, {
        san: string;
        uci: string;
        from: string;
        to: string;
        promotion?: string;
        fenAfter: string;
        games: number;
        wins: number;
        draws: number;
        losses: number;
    }>();

    let matchingGames = 0;
    const seenGameIds = new Set<string>();

    for (const game of games) {
        try {
            const chess = new Chess();
            chess.loadPgn(game.pgn);
            const history = chess.history({ verbose: true }) as any[];
            const replay = new Chess();

            for (const move of history) {
                const positionKey = normalizeFen(replay.fen());
                if (positionKey === targetKey) {
                    if (!seenGameIds.has(game.id)) {
                        seenGameIds.add(game.id);
                        matchingGames++;
                    }

                    const played = replay.move({
                        from: move.from,
                        to: move.to,
                        promotion: move.promotion,
                    });
                    if (!played) break;

                    const uci = `${move.from}${move.to}${move.promotion || ''}`;
                    const stats = moves.get(uci) || {
                        san: move.san,
                        uci,
                        from: move.from,
                        to: move.to,
                        promotion: move.promotion,
                        fenAfter: replay.fen(),
                        games: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                    };

                    stats.games++;
                    if (game.result === '1/2-1/2') {
                        stats.draws++;
                    } else if (isUserWin(game as Game)) {
                        stats.wins++;
                    } else if (isUserLoss(game as Game)) {
                        stats.losses++;
                    }
                    moves.set(uci, stats);
                } else {
                    const played = replay.move({
                        from: move.from,
                        to: move.to,
                        promotion: move.promotion,
                    });
                    if (!played) break;
                }
            }
        } catch {
            continue;
        }
    }

    const nextMoves = Array.from(moves.values()).map(move => ({
        ...move,
        winRate: move.games ? Math.round((move.wins / move.games) * 100) : 0,
        drawRate: move.games ? Math.round((move.draws / move.games) * 100) : 0,
        lossRate: move.games ? Math.round((move.losses / move.games) * 100) : 0,
    })).sort((a, b) => b.games - a.games || b.winRate - a.winRate);

    return {
        fen: targetFen,
        positionKey: targetKey,
        sideToMove: targetPosition.turn() === 'w' ? 'white' : 'black',
        moveNumber: targetPosition.moveNumber(),
        games: matchingGames,
        nextMoves,
    };
}

export async function getAdvancedInsights() {
    const db = getDb();
    const rows = db.prepare(`
        SELECT a.*, g.time_control, g.opening_eco, g.opening_name, g.result, g.user_color
        FROM analysis a
        JOIN games g ON g.id = a.game_id
        WHERE a.is_user_move = 1
    `).all() as Array<MoveAnalysis & {
        time_control: string;
        opening_eco: string;
        opening_name: string;
        result: string;
        user_color: 'white' | 'black';
    }>;

    const byTime = new Map<string, { games: Set<string>; moves: number; cpLoss: number; blunders: number }>();
    const byPiece = new Map<string, { moves: number; cpLoss: number; blunders: number; mistakes: number }>();
    const missedForks = new Map<string, { count: number; examples: string[] }>();
    const hangingPieces = new Map<string, { count: number; avgLoss: number }>();

    for (const row of rows) {
        const timeBucket = getTimeBucket(row.time_control);
        const time = byTime.get(timeBucket) || { games: new Set<string>(), moves: 0, cpLoss: 0, blunders: 0 };
        time.games.add(row.game_id);
        time.moves++;
        time.cpLoss += row.cp_loss || 0;
        if (row.classification === 'blunder') time.blunders++;
        byTime.set(timeBucket, time);

        const movedPiece = pieceFromSan(row.move_played);
        const piece = byPiece.get(movedPiece) || { moves: 0, cpLoss: 0, blunders: 0, mistakes: 0 };
        piece.moves++;
        piece.cpLoss += row.cp_loss || 0;
        if (row.classification === 'blunder') piece.blunders++;
        if (row.classification === 'mistake') piece.mistakes++;
        byPiece.set(movedPiece, piece);

        if ((row.classification === 'blunder' || row.classification === 'mistake') && row.cp_loss >= 100) {
            const hanging = hangingPieces.get(movedPiece) || { count: 0, avgLoss: 0 };
            hanging.count++;
            hanging.avgLoss += row.cp_loss || 0;
            hangingPieces.set(movedPiece, hanging);
        }

        if (row.cp_loss >= 50 && row.best_move) {
            const bestPiece = pieceFromBestMove(row.fen, row.best_move);
            if (bestPiece === 'Knight' || bestPiece === 'Queen') {
                const fork = missedForks.get(bestPiece) || { count: 0, examples: [] };
                fork.count++;
                if (fork.examples.length < 3) {
                    fork.examples.push(`${row.move_played} instead of ${row.best_move}`);
                }
                missedForks.set(bestPiece, fork);
            }
        }
    }

    const accuracyByTime = Array.from(byTime.entries()).map(([timeControl, stats]) => ({
        timeControl,
        games: stats.games.size,
        moves: stats.moves,
        accuracy: stats.moves ? accuracyFromCpLoss(stats.cpLoss / stats.moves) : 0,
        blunderRate: stats.moves ? Math.round((stats.blunders / stats.moves) * 1000) / 10 : 0,
    })).sort((a, b) => b.games - a.games);

    const piecePerformance = Array.from(byPiece.entries()).map(([piece, stats]) => ({
        piece,
        moves: stats.moves,
        accuracy: stats.moves ? accuracyFromCpLoss(stats.cpLoss / stats.moves) : 0,
        blunders: stats.blunders,
        mistakes: stats.mistakes,
    })).sort((a, b) => a.accuracy - b.accuracy);

    const openingRows = db.prepare(`
        WITH per_game AS (
            SELECT
                g.id,
                g.opening_eco as eco,
                g.opening_name as name,
                CASE WHEN (g.user_color = 'white' AND g.result = '1-0')
                    OR (g.user_color = 'black' AND g.result = '0-1')
                THEN 1 ELSE 0 END as won,
                AVG(CASE WHEN a.is_user_move = 1 THEN a.cp_loss ELSE NULL END) as avgCpLoss,
                SUM(CASE WHEN a.is_user_move = 1 AND a.classification = 'blunder' THEN 1 ELSE 0 END) as blunders,
                SUM(CASE WHEN a.is_user_move = 1 THEN 1 ELSE 0 END) as userMoves
            FROM games g
            LEFT JOIN analysis a ON a.game_id = g.id
            WHERE g.opening_eco != '' AND g.opening_eco IS NOT NULL
            GROUP BY g.id
        )
        SELECT
            eco,
            name,
            COUNT(*) as games,
            SUM(won) as wins,
            AVG(avgCpLoss) as avgCpLoss,
            SUM(blunders) as blunders,
            SUM(userMoves) as userMoves
        FROM per_game
        GROUP BY eco
        HAVING COUNT(*) >= 2
    `).all() as Array<{ eco: string; name: string; games: number; wins: number; avgCpLoss: number; blunders: number; userMoves: number }>;

    const openingInsights = openingRows.map(row => ({
        eco: row.eco,
        name: row.name,
        games: row.games,
        winRate: row.games ? Math.max(0, Math.min(100, Math.round((row.wins / row.games) * 100))) : 0,
        accuracy: row.avgCpLoss ? accuracyFromCpLoss(row.avgCpLoss) : 0,
        blunderRate: row.userMoves ? Math.round(((row.blunders || 0) / row.userMoves) * 1000) / 10 : 0,
    }));

    const movesToAvoid = db.prepare(`
        SELECT
            g.opening_eco as eco,
            g.opening_name as name,
            a.move_played as move,
            a.classification,
            COUNT(*) as count,
            AVG(a.cp_loss) as avgLoss
        FROM analysis a
        JOIN games g ON g.id = a.game_id
        WHERE a.is_user_move = 1
            AND a.classification IN ('blunder', 'mistake')
            AND g.opening_eco != ''
            AND g.opening_eco IS NOT NULL
        GROUP BY g.opening_eco, a.move_played, a.classification
        HAVING COUNT(*) >= 2
        ORDER BY count DESC, avgLoss DESC
        LIMIT 12
    `).all() as Array<{ eco: string; name: string; move: string; classification: string; count: number; avgLoss: number }>;

    const recommendations = [
        ...openingInsights
            .filter(opening => opening.games >= 2 && opening.winRate >= 55 && opening.accuracy >= 85)
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 3)
            .map(opening => `Play more ${opening.eco} ${opening.name}: ${opening.winRate}% win rate with ${opening.accuracy}% accuracy.`),
        ...openingInsights
            .filter(opening => opening.blunderRate >= 5)
            .sort((a, b) => b.blunderRate - a.blunderRate)
            .slice(0, 3)
            .map(opening => `Learn ${opening.eco} ${opening.name}: ${opening.blunderRate}% average blunder rate.`),
        ...movesToAvoid
            .slice(0, 3)
            .map(move => `Avoid ${move.move} in ${move.eco}: repeated ${move.classification}, average loss ${Math.round(move.avgLoss)} cp.`),
        ...piecePerformance
            .filter(piece => piece.moves >= 3)
            .slice(0, 2)
            .map(piece => `Check ${piece.piece.toLowerCase()} safety: ${piece.blunders} blunders and ${piece.mistakes} mistakes.`),
    ].slice(0, 8);

    return {
        accuracyByTime,
        piecePerformance,
        openingInsights: openingInsights.sort((a, b) => b.blunderRate - a.blunderRate),
        recommendations,
        movesToAvoid,
        missedForks: Array.from(missedForks.entries()).map(([piece, stats]) => ({ piece, ...stats })).sort((a, b) => b.count - a.count),
        hangingPieces: Array.from(hangingPieces.entries()).map(([piece, stats]) => ({
            piece,
            count: stats.count,
            avgLoss: Math.round(stats.avgLoss / stats.count),
        })).sort((a, b) => b.count - a.count),
    };
}
