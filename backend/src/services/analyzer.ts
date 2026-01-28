import { Chess } from 'chess.js';
import type { MoveAnalysis, StockfishEval } from '../types.js';

// Thresholds in centipawns
const BLUNDER_THRESHOLD = 200;
const MISTAKE_THRESHOLD = 100;
const INACCURACY_THRESHOLD = 50;

export interface PlayerStats {
    totalMoves: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    excellent: number;
    great: number;
    best: number;
    brilliant: number;
    accuracy: number;
}

export interface AnalysisResult {
    moves: MoveAnalysis[];
    summary: {
        totalMoves: number;
        user: PlayerStats;
        opponent: PlayerStats;
        gamePhaseBreakdown: {
            opening: { blunders: number; mistakes: number };
            middlegame: { blunders: number; mistakes: number };
            endgame: { blunders: number; mistakes: number };
        };
    };
}

/**
 * Parse PGN and extract game metadata
 */
export function parsePgn(pgn: string): {
    moves: string[];
    headers: Record<string, any>;
} {
    const chess = new Chess();
    chess.loadPgn(pgn);

    const headers = chess.header();
    // Get moves history
    const history = chess.history();

    return { moves: history, headers };
}

/**
 * Classify centipawn loss into categories
 */
export function classifyMove(
    cpLoss: number,
    isBestMove: boolean,
    evalBefore: number,
    evalAfter: number,
    isWhite: boolean
): MoveAnalysis['classification'] {
    if (cpLoss >= BLUNDER_THRESHOLD) return 'blunder';
    if (cpLoss >= MISTAKE_THRESHOLD) return 'mistake';
    if (cpLoss >= INACCURACY_THRESHOLD) return 'inaccuracy';

    if (isBestMove) {
        const improvement = isWhite ? (evalAfter - evalBefore) : (evalBefore - evalAfter);
        if (improvement > 80 && Math.abs(evalBefore) < 200) return 'brilliant';
        if (improvement > 40) return 'great';
        return 'best';
    }

    if (cpLoss < 15) return 'excellent';
    return 'good';
}

/**
 * Determine game phase based on material and move number
 */
export function getGamePhase(fen: string, moveNumber: number): 'opening' | 'middlegame' | 'endgame' {
    if (moveNumber <= 10) return 'opening';

    // Count pieces to determine if it's endgame
    const pieceCount = fen.split(' ')[0].replace(/[0-9/]/g, '').length;

    if (pieceCount <= 12) return 'endgame';
    return 'middlegame';
}

/**
 * Extract opening info from PGN headers
 */
export function extractOpeningInfo(headers: Record<string, any>): {
    eco: string;
    name: string;
} {
    return {
        eco: headers['ECO'] || headers['Opening'] || 'Unknown',
        name: headers['ECOUrl']?.split('/').pop()?.replace(/-/g, ' ') ||
            headers['Opening'] ||
            'Unknown Opening',
    };
}

/**
 * Calculate average accuracy from evaluations
 */
export function calculateAccuracy(evalBefore: number, evalAfter: number, isWhite: boolean): number {
    const winChanceBefore = cpToWinChance(evalBefore);
    const winChanceAfter = cpToWinChance(evalAfter);

    const winChanceLoss = isWhite ? (winChanceBefore - winChanceAfter) : (winChanceAfter - winChanceBefore);
    const safeLoss = Math.max(0, winChanceLoss);

    // Chess.com accurate model
    const accuracy = 100 * Math.exp(-0.05 * safeLoss);

    return Math.round(accuracy * 10) / 10;
}

/**
 * Convert centipawns to win chance percentage
 */
function cpToWinChance(cp: number): number {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Generate summary statistics from move analysis
 */
export function generateSummary(moves: MoveAnalysis[]): AnalysisResult['summary'] {
    const analyzePlayer = (isUser: boolean): PlayerStats => {
        const playerMoves = moves.filter(m => !!m.is_user_move === isUser);
        const stats: PlayerStats = {
            totalMoves: playerMoves.length,
            blunders: 0,
            mistakes: 0,
            inaccuracies: 0,
            excellent: 0,
            great: 0,
            best: 0,
            brilliant: 0,
            accuracy: 0
        };

        let totalAcc = 0;
        for (const m of playerMoves) {
            const cat = m.classification as keyof Omit<PlayerStats, 'accuracy' | 'totalMoves'>;
            if (stats[cat] !== undefined) {
                stats[cat]++;
            }
            const isWhite = (m.ply % 2 === 1);
            totalAcc += calculateAccuracy(m.eval_before, m.eval_after, isWhite);
        }

        if (stats.totalMoves > 0) {
            stats.accuracy = Math.round((totalAcc / stats.totalMoves) * 10) / 10;
        }

        return stats;
    };

    const userStats = analyzePlayer(true);
    const opponentStats = analyzePlayer(false);

    const gamePhaseBreakdown = {
        opening: { blunders: 0, mistakes: 0 },
        middlegame: { blunders: 0, mistakes: 0 },
        endgame: { blunders: 0, mistakes: 0 },
    };

    for (const move of moves.filter(m => m.is_user_move)) {
        const phase = getGamePhase(move.fen, move.move_number);
        if (move.classification === 'blunder') {
            gamePhaseBreakdown[phase].blunders++;
        } else if (move.classification === 'mistake') {
            gamePhaseBreakdown[phase].mistakes++;
        }
    }

    return {
        totalMoves: moves.length,
        user: userStats,
        opponent: opponentStats,
        gamePhaseBreakdown,
    };
}
