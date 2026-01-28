import { getDb } from './db/init.js';
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
    if (analyzed !== undefined) { whereClause += ' AND analyzed = ?'; params.push(analyzed === 'true' || analyzed === 1 ? 1 : 0); }
    if (result) { whereClause += ' AND result = ?'; params.push(result); }

    const validSortFields = ['played_at', 'opening_eco', 'result'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'played_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const countResult = db.prepare(`SELECT COUNT(*) as count FROM games ${whereClause}`).get(...params) as { count: number };
    const games = db.prepare(`
        SELECT id, source, white_player, black_player, user_color, result, 
               time_control, opening_eco, opening_name, played_at, analyzed
        FROM games ${whereClause}
        ORDER BY ${sortField} ${sortOrder}
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

    const analysis = db.prepare('SELECT * FROM analysis WHERE game_id = ? ORDER BY ply ASC').all(id);
    return { game, analysis, hasAnalysis: analysis.length > 0 };
}

/**
 * ANALYSIS HANDLERS
 */

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
