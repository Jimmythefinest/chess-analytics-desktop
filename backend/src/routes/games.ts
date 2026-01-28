import { Router } from 'express';
import { getDb } from '../db/init.js';
import * as chesscom from '../services/chesscom.js';
import * as lichess from '../services/lichess.js';
import { parsePgn, extractOpeningInfo } from '../services/analyzer.js';
import type { Game } from '../types.js';

export const gamesRouter = Router();

/**
 * Import games from Chess.com
 */
gamesRouter.post('/import/chesscom/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 100 } = req.body;

        console.log(`Importing up to ${limit} games for Chess.com user: ${username}`);

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
                gameId,
                'chesscom',
                game.pgn,
                game.white.username,
                game.black.username,
                userColor,
                result,
                game.time_control,
                opening.eco,
                opening.name,
                new Date(game.end_time * 1000).toISOString()
            );

            if (changes.changes > 0) imported++;
        }

        res.json({
            success: true,
            message: `Imported ${imported} new games from Chess.com`,
            total: games.length,
            imported,
        });
    } catch (error: any) {
        console.error('Chess.com import error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Import games from Lichess
 */
gamesRouter.post('/import/lichess/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 100 } = req.body;

        console.log(`Importing up to ${limit} games for Lichess user: ${username}`);

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
            const userColor = lichess.getPlayerName(game, 'white').toLowerCase() === username.toLowerCase()
                ? 'white'
                : 'black';

            const changes = insertStmt.run(
                gameId,
                'lichess',
                game.pgn,
                lichess.getPlayerName(game, 'white'),
                lichess.getPlayerName(game, 'black'),
                userColor,
                result,
                lichess.getTimeControl(game),
                game.opening?.eco || '',
                game.opening?.name || '',
                new Date(game.createdAt).toISOString()
            );

            if (changes.changes > 0) imported++;
        }

        res.json({
            success: true,
            message: `Imported ${imported} new games from Lichess`,
            total: games.length,
            imported,
        });
    } catch (error: any) {
        console.error('Lichess import error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * List all games with pagination and filtering
 */
gamesRouter.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            source,
            opening,
            analyzed,
            result,
            sortBy = 'played_at',
            order = 'desc'
        } = req.query;

        const db = getDb();
        const offset = (Number(page) - 1) * Number(limit);

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];

        if (source) {
            whereClause += ' AND source = ?';
            params.push(source);
        }
        if (opening) {
            whereClause += ' AND opening_eco LIKE ?';
            params.push(`${opening}%`);
        }
        if (analyzed !== undefined) {
            whereClause += ' AND analyzed = ?';
            params.push(analyzed === 'true' ? 1 : 0);
        }
        if (result) {
            whereClause += ' AND result = ?';
            params.push(result);
        }

        const validSortFields = ['played_at', 'opening_eco', 'result'];
        const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'played_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM games ${whereClause}`).get(...params) as { count: number };

        // Get games
        const games = db.prepare(`
      SELECT id, source, white_player, black_player, user_color, result, 
             time_control, opening_eco, opening_name, played_at, analyzed
      FROM games 
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

        res.json({
            games,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: countResult.count,
                pages: Math.ceil(countResult.count / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error('Get games error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get single game with analysis
 */
gamesRouter.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();

        const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const analysis = db.prepare(`
      SELECT * FROM analysis WHERE game_id = ? ORDER BY ply ASC
    `).all(id);

        res.json({
            game,
            analysis,
            hasAnalysis: analysis.length > 0,
        });
    } catch (error: any) {
        console.error('Get game error:', error);
        res.status(500).json({ error: error.message });
    }
});
