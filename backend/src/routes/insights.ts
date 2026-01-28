import { Router } from 'express';
import { getDb } from '../db/init.js';
import type { InsightsOverview, OpeningStats } from '../types.js';

export const insightsRouter = Router();

/**
 * Get dashboard overview statistics
 */
insightsRouter.get('/overview', async (req, res) => {
    try {
        const db = getDb();

        // Total and analyzed games
        const gameStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(analyzed) as analyzed
      FROM games
    `).get() as { total: number; analyzed: number };

        // Win rate (considering user_color)
        const winStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE 
          WHEN (user_color = 'white' AND result = '1-0') OR (user_color = 'black' AND result = '0-1')
          THEN 1 ELSE 0 
        END) as wins,
        SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
      FROM games
    `).get() as { total: number; wins: number; draws: number };

        const winRate = winStats.total > 0
            ? Math.round((winStats.wins / winStats.total) * 100)
            : 0;

        // Blunder stats from analyzed games
        const blunderStats = db.prepare(`
      SELECT 
        COUNT(*) as totalMoves,
        SUM(CASE WHEN classification = 'blunder' THEN 1 ELSE 0 END) as blunders,
        AVG(CASE WHEN is_user_move = 1 THEN cp_loss ELSE NULL END) as avgCpLoss
      FROM analysis
      WHERE is_user_move = 1
    `).get() as { totalMoves: number; blunders: number; avgCpLoss: number };

        const blunderRate = blunderStats.totalMoves > 0
            ? Math.round((blunderStats.blunders / blunderStats.totalMoves) * 100 * 10) / 10
            : 0;

        // Most played opening
        const topOpening = db.prepare(`
      SELECT opening_eco as eco, opening_name as name, COUNT(*) as count
      FROM games
      WHERE opening_eco != '' AND opening_eco IS NOT NULL
      GROUP BY opening_eco
      ORDER BY count DESC
      LIMIT 1
    `).get() as { eco: string; name: string; count: number } | undefined;

        // Calculate accuracy (simplified: 100 - normalized avg cp loss)
        const avgAccuracy = blunderStats.avgCpLoss
            ? Math.max(0, Math.min(100, 100 - (blunderStats.avgCpLoss / 10)))
            : null;

        const overview: InsightsOverview = {
            totalGames: gameStats.total,
            analyzedGames: gameStats.analyzed || 0,
            winRate,
            blunderRate,
            averageAccuracy: avgAccuracy ? Math.round(avgAccuracy * 10) / 10 : 0,
            mostPlayedOpening: topOpening || { eco: 'N/A', name: 'No games', count: 0 },
            recentTrend: 'stable', // TODO: Calculate from recent games
        };

        res.json(overview);
    } catch (error: any) {
        console.error('Overview error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get opening performance statistics
 */
insightsRouter.get('/openings', async (req, res) => {
    try {
        const { minGames = 3 } = req.query;
        const db = getDb();

        const openings = db.prepare(`
      SELECT 
        g.opening_eco as eco,
        g.opening_name as name,
        COUNT(*) as gamesPlayed,
        SUM(CASE 
          WHEN (g.user_color = 'white' AND g.result = '1-0') OR (g.user_color = 'black' AND g.result = '0-1')
          THEN 1 ELSE 0 
        END) as wins,
        SUM(CASE 
          WHEN (g.user_color = 'white' AND g.result = '0-1') OR (g.user_color = 'black' AND g.result = '1-0')
          THEN 1 ELSE 0 
        END) as losses,
        SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
      FROM games g
      WHERE g.opening_eco != '' AND g.opening_eco IS NOT NULL
      GROUP BY g.opening_eco
      HAVING COUNT(*) >= ?
      ORDER BY gamesPlayed DESC
    `).all(Number(minGames)) as any[];

        // Calculate blunders per opening
        const openingStats: OpeningStats[] = openings.map(o => {
            const blunderData = db.prepare(`
        SELECT AVG(blunderCount) as avgBlunders
        FROM (
          SELECT a.game_id, COUNT(*) as blunderCount
          FROM analysis a
          JOIN games g ON a.game_id = g.id
          WHERE g.opening_eco = ? AND a.classification = 'blunder' AND a.is_user_move = 1
          GROUP BY a.game_id
        )
      `).get(o.eco) as { avgBlunders: number } | undefined;

            return {
                eco: o.eco,
                name: o.name,
                gamesPlayed: o.gamesPlayed,
                wins: o.wins,
                losses: o.losses,
                draws: o.draws,
                avgBlunders: blunderData?.avgBlunders ? Math.round(blunderData.avgBlunders * 10) / 10 : 0,
                winRate: Math.round((o.wins / o.gamesPlayed) * 100),
            };
        });

        res.json({
            openings: openingStats,
            total: openingStats.length,
        });
    } catch (error: any) {
        console.error('Openings error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get blunder patterns and analysis
 */
insightsRouter.get('/blunders', async (req, res) => {
    try {
        const db = getDb();

        // Blunders by game phase
        const phaseBlunders = db.prepare(`
      SELECT 
        CASE 
          WHEN move_number <= 10 THEN 'opening'
          WHEN move_number <= 25 THEN 'middlegame'
          ELSE 'endgame'
        END as phase,
        COUNT(*) as count
      FROM analysis
      WHERE classification = 'blunder' AND is_user_move = 1
      GROUP BY phase
    `).all() as { phase: string; count: number }[];

        // Most common blunder positions (by opening)
        const blunderOpenings = db.prepare(`
      SELECT g.opening_eco as eco, g.opening_name as name, COUNT(*) as blunders
      FROM analysis a
      JOIN games g ON a.game_id = g.id
      WHERE a.classification = 'blunder' AND a.is_user_move = 1
      GROUP BY g.opening_eco
      ORDER BY blunders DESC
      LIMIT 10
    `).all();

        // Recent blunders for review
        const recentBlunders = db.prepare(`
      SELECT 
        a.game_id,
        a.move_number,
        a.fen,
        a.move_played,
        a.best_move,
        a.cp_loss,
        g.white_player,
        g.black_player,
        g.played_at
      FROM analysis a
      JOIN games g ON a.game_id = g.id
      WHERE a.classification = 'blunder' AND a.is_user_move = 1
      ORDER BY g.played_at DESC
      LIMIT 20
    `).all();

        // Blunder frequency over time (by month)
        const monthlyTrend = db.prepare(`
      SELECT 
        strftime('%Y-%m', g.played_at) as month,
        COUNT(*) as gameCount,
        SUM(CASE WHEN a.classification = 'blunder' AND a.is_user_move = 1 THEN 1 ELSE 0 END) as blunders
      FROM games g
      LEFT JOIN analysis a ON g.id = a.game_id
      WHERE g.analyzed = 1
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all();

        res.json({
            byPhase: phaseBlunders,
            byOpening: blunderOpenings,
            recent: recentBlunders,
            monthlyTrend,
        });
    } catch (error: any) {
        console.error('Blunders error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get improvement progress over time
 */
insightsRouter.get('/progress', async (req, res) => {
    try {
        const db = getDb();

        // Performance by month
        const monthlyPerformance = db.prepare(`
      SELECT 
        strftime('%Y-%m', played_at) as month,
        COUNT(*) as games,
        SUM(CASE 
          WHEN (user_color = 'white' AND result = '1-0') OR (user_color = 'black' AND result = '0-1')
          THEN 1 ELSE 0 
        END) as wins,
        SUM(CASE 
          WHEN (user_color = 'white' AND result = '0-1') OR (user_color = 'black' AND result = '1-0')
          THEN 1 ELSE 0 
        END) as losses
      FROM games
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all() as { month: string; games: number; wins: number; losses: number }[];

        // Calculate win rate trend
        const withWinRate = monthlyPerformance.map(m => ({
            ...m,
            winRate: m.games > 0 ? Math.round((m.wins / m.games) * 100) : 0,
        }));

        // Average blunders per game trend
        const blunderTrend = db.prepare(`
      SELECT 
        strftime('%Y-%m', g.played_at) as month,
        ROUND(AVG(blunderCount), 2) as avgBlunders
      FROM (
        SELECT a.game_id, COUNT(*) as blunderCount
        FROM analysis a
        WHERE a.classification = 'blunder' AND a.is_user_move = 1
        GROUP BY a.game_id
      ) sub
      JOIN games g ON sub.game_id = g.id
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all();

        res.json({
            monthlyPerformance: withWinRate.reverse(),
            blunderTrend: (blunderTrend as any[]).reverse(),
        });
    } catch (error: any) {
        console.error('Progress error:', error);
        res.status(500).json({ error: error.message });
    }
});
