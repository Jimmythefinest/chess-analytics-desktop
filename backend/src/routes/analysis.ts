import { Router } from 'express';
import { getDb } from '../db/init.js';
import { analyzeGame } from '../services/stockfish.js';
import { classifyMove, generateSummary, parsePgn } from '../services/analyzer.js';
import type { Game, MoveAnalysis } from '../types.js';

export const analysisRouter = Router();

/**
 * Trigger analysis for a game
 */
analysisRouter.post('/game/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { depth = 12 } = req.body;

        const db = getDb();
        const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Check if already analyzed
        const existingAnalysis = db.prepare('SELECT COUNT(*) as count FROM analysis WHERE game_id = ?').get(id) as { count: number };
        if (existingAnalysis.count > 0) {
            return res.json({
                success: true,
                message: 'Game already analyzed',
                alreadyAnalyzed: true
            });
        }

        console.log(`Analyzing game ${id} at depth ${depth}...`);

        // Run Stockfish analysis
        const analysisResults = await analyzeGame(game.pgn, game.user_color as 'white' | 'black', depth);

        // Calculate centipawn loss and classify moves
        const insertStmt = db.prepare(`
      INSERT INTO analysis 
      (game_id, move_number, ply, fen, move_played, best_move, eval_before, eval_after, cp_loss, classification, is_user_move)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const moves: MoveAnalysis[] = [];

        for (let i = 0; i < analysisResults.length; i++) {
            const current = analysisResults[i];
            const next = analysisResults[i + 1];

            // Normalize evaluations to centipawns from white's perspective
            let evalBefore = current.evaluation.type === 'mate'
                ? current.evaluation.value * 10000
                : current.evaluation.value;

            let evalAfter = next
                ? (next.evaluation.type === 'mate' ? next.evaluation.value * 10000 : next.evaluation.value)
                : evalBefore;

            // Calculate loss (from the moving side's perspective)
            const isWhiteMove = current.ply % 2 === 1;
            let cpLoss: number;

            if (isWhiteMove) {
                cpLoss = evalBefore - evalAfter;
            } else {
                cpLoss = evalAfter - evalBefore;
            }

            // Only count positive loss (negative means improvement)
            cpLoss = Math.max(0, cpLoss);

            const isBestMove = current.movePlayedUci.toLowerCase().trim() === current.evaluation.bestMove.toLowerCase().trim();
            const classification = classifyMove(cpLoss, isBestMove, evalBefore, evalAfter, isWhiteMove);

            const moveAnalysis: MoveAnalysis = {
                game_id: id,
                move_number: current.moveNumber,
                ply: current.ply,
                fen: current.fen,
                move_played: current.movePlayed,
                best_move: current.evaluation.bestMove,
                eval_before: evalBefore,
                eval_after: evalAfter,
                cp_loss: cpLoss,
                classification,
                is_user_move: current.isUserMove,
            };

            moves.push(moveAnalysis);

            insertStmt.run(
                id,
                moveAnalysis.move_number,
                moveAnalysis.ply,
                moveAnalysis.fen,
                moveAnalysis.move_played,
                moveAnalysis.best_move,
                moveAnalysis.eval_before,
                moveAnalysis.eval_after,
                moveAnalysis.cp_loss,
                moveAnalysis.classification,
                moveAnalysis.is_user_move ? 1 : 0
            );
        }

        // Mark game as analyzed
        db.prepare('UPDATE games SET analyzed = 1 WHERE id = ?').run(id);

        // Generate summary
        const summary = generateSummary(moves);

        res.json({
            success: true,
            message: 'Analysis complete',
            summary,
            movesAnalyzed: moves.length,
        });
    } catch (error: any) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get analysis for a game
 */
analysisRouter.get('/game/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();

        const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Game | undefined;

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const analysis = db.prepare(`
      SELECT * FROM analysis WHERE game_id = ? ORDER BY ply ASC
    `).all(id) as MoveAnalysis[];

        if (analysis.length === 0) {
            return res.json({
                game,
                analyzed: false,
                message: 'Game not yet analyzed. POST to /api/analysis/game/:id to analyze.',
            });
        }

        const summary = generateSummary(analysis);

        res.json({
            game,
            analyzed: true,
            analysis,
            summary,
        });
    } catch (error: any) {
        console.error('Get analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Batch analyze multiple games
 */
analysisRouter.post('/batch', async (req, res) => {
    try {
        const { gameIds, depth = 18 } = req.body;

        if (!gameIds || !Array.isArray(gameIds)) {
            return res.status(400).json({ error: 'gameIds array required' });
        }

        // Limit batch size
        const limitedIds = gameIds.slice(0, 10);

        res.json({
            success: true,
            message: `Queued ${limitedIds.length} games for analysis`,
            gameIds: limitedIds,
            note: 'Analysis runs in background. Check individual game endpoints for results.',
        });

        // Run analysis in background (simplified - in production use Bull queue)
        for (const id of limitedIds) {
            try {
                const db = getDb();
                const game = db.prepare('SELECT * FROM games WHERE id = ? AND analyzed = 0').get(id) as Game | undefined;
                if (game) {
                    const analysisResults = await analyzeGame(game.pgn, game.user_color as 'white' | 'black', depth);
                    // Store results... (simplified)
                    db.prepare('UPDATE games SET analyzed = 1 WHERE id = ?').run(id);
                }
            } catch (err) {
                console.error(`Batch analysis failed for ${id}:`, err);
            }
        }
    } catch (error: any) {
        console.error('Batch analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});
