import { Chess } from 'chess.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { StockfishEval } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DEPTH = 10;
const ENGINE_TIMEOUT = 30000; // 30 seconds max per position

interface StockfishInstance {
    process: ChildProcess;
    busy: boolean;
    queue: Array<{
        fen: string;
        depth: number;
        resolve: (eval_: StockfishEval) => void;
        reject: (err: Error) => void;
    }>;
}

class StockfishPool {
    private instances: StockfishInstance[] = [];
    private poolSize: number;
    private initialized = false;

    constructor(poolSize = 2) {
        this.poolSize = poolSize;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        for (let i = 0; i < this.poolSize; i++) {
            const instance = await this.createInstance();
            this.instances.push(instance);
        }

        this.initialized = true;
        console.log(`✅ Stockfish pool initialized with ${this.poolSize} workers`);
    }

    private async createInstance(): Promise<StockfishInstance> {
        // Try to find stockfish binary
        const isDev = process.env.NODE_ENV === 'development';
        const resourcesPath = (process as any).resourcesPath;
        const binPath = (isDev || !resourcesPath)
            ? path.join(__dirname, '../../bin')
            : path.join(resourcesPath, 'backend/bin');

        console.log('🔍 Stockfish initialization:');
        console.log('  - isDev:', isDev);
        console.log('  - resourcesPath:', resourcesPath);
        console.log('  - __dirname:', __dirname);
        console.log('  - binPath:', binPath);

        const stockfishPaths = [
            path.join(binPath, process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'),
            'stockfish',
            '/usr/bin/stockfish',
            '/usr/local/bin/stockfish',
            '/usr/games/stockfish',
        ];

        console.log('  - Trying paths:', stockfishPaths);

        let spawnedProcess: ChildProcess | null = null;
        let lastError: any = null;
        let successfulPath = '';

        // Helper to test if a spawn actually works
        const testSpawn = (sfPath: string): Promise<ChildProcess> => {
            return new Promise((resolve, reject) => {
                console.log(`  ➤ Attempting to spawn: ${sfPath}`);

                const proc = spawn(sfPath, [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                let hasResponded = false;

                const onError = (err: Error) => {
                    console.log(`  ❌ Spawn error for ${sfPath}:`, err.message);
                    cleanup();
                    reject(err);
                };

                const onData = (data: Buffer) => {
                    if (!hasResponded) {
                        hasResponded = true;
                        console.log(`  ✅ Process responding: ${sfPath}`);
                        cleanup();
                        resolve(proc);
                    }
                };

                const cleanup = () => {
                    proc.stderr?.removeListener('data', onError);
                    proc.stdout?.removeListener('data', onData);
                    proc.removeListener('error', onError);
                };

                proc.on('error', onError);
                proc.stderr?.on('data', onError);
                proc.stdout?.once('data', onData);

                // Send UCI command to test if it's working
                try {
                    proc.stdin?.write('uci\n');
                } catch (err) {
                    console.log(`  ❌ Failed to write to stdin for ${sfPath}`);
                    cleanup();
                    reject(err);
                }

                // Timeout after 1 second
                setTimeout(() => {
                    if (!hasResponded) {
                        cleanup();
                        proc.kill();
                        reject(new Error('Process did not respond within 1s'));
                    }
                }, 1000);
            });
        };

        // Try each path until one works
        for (const sfPath of stockfishPaths) {
            try {
                spawnedProcess = await testSpawn(sfPath);
                successfulPath = sfPath;
                break;
            } catch (err: any) {
                lastError = err;
                continue;
            }
        }

        if (!spawnedProcess) {
            const errorMsg = `Stockfish not found or failed to start. Tried paths: ${stockfishPaths.join(', ')}. Last error: ${lastError?.message || lastError}`;
            console.error('❌', errorMsg);
            throw new Error(errorMsg);
        }

        console.log(`  ✅ Stockfish ready from: ${successfulPath}`);

        const instance: StockfishInstance = {
            process: spawnedProcess,
            busy: false,
            queue: [],
        };

        // Initialize UCI
        return new Promise((resolve, reject) => {
            let output = '';
            const onData = (data: Buffer) => {
                output += data.toString();
                if (output.includes('uciok') && !output.includes('readyok')) {
                    if (!output.includes('_options_sent_')) {
                        output += '_options_sent_';
                        spawnedProcess!.stdin?.write('setoption name Threads value 1\n');
                        spawnedProcess!.stdin?.write('setoption name Hash value 128\n');
                        spawnedProcess!.stdin?.write('isready\n');
                    }
                }
                if (output.includes('readyok')) {
                    spawnedProcess!.stdout?.off('data', onData);
                    resolve(instance);
                }
            };

            spawnedProcess!.stdout?.on('data', onData);
            spawnedProcess!.stderr?.on('data', (data) => {
                console.error('Stockfish error:', data.toString());
            });
            spawnedProcess!.on('error', (err) => {
                console.error('Stockfish process error:', err);
                reject(err);
            });

            spawnedProcess!.stdin?.write('uci\n');

            setTimeout(() => {
                if (!output.includes('readyok')) {
                    reject(new Error('Stockfish init timeout'));
                }
            }, 30000);
        });
    }

    async evaluate(fen: string, depth = DEFAULT_DEPTH): Promise<StockfishEval> {
        if (!this.initialized) {
            await this.initialize();
        }

        // Find available instance
        let instance = this.instances.find(i => !i.busy);

        if (!instance) {
            // All busy, queue on first instance
            instance = this.instances[0];
        }

        return new Promise((resolve, reject) => {
            if (instance!.busy) {
                instance!.queue.push({ fen, depth, resolve, reject });
                return;
            }

            this.runEvaluation(instance!, fen, depth, resolve, reject);
        });
    }

    private runEvaluation(
        instance: StockfishInstance,
        fen: string,
        depth: number,
        resolve: (eval_: StockfishEval) => void,
        reject: (err: Error) => void
    ): void {
        instance.busy = true;
        let output = '';
        let bestMove = '';
        let evaluation: StockfishEval | null = null;

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Evaluation timeout'));
        }, ENGINE_TIMEOUT);

        const onData = (data: Buffer) => {
            output += data.toString();
            const lines = output.split('\n');

            for (const line of lines) {
                // Parse info lines for evaluation
                if (line.startsWith('info depth')) {
                    const depthMatch = line.match(/depth (\d+)/);
                    const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

                    if (currentDepth >= depth - 2) {
                        // Parse score
                        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
                        const pvMatch = line.match(/pv (.+)/);

                        if (scoreMatch) {
                            let value = parseInt(scoreMatch[2]);

                            // Normalize to white's perspective
                            const isBlackTurn = fen.split(' ')[1] === 'b';
                            if (isBlackTurn) {
                                value = -value;
                            }

                            evaluation = {
                                type: scoreMatch[1] as 'cp' | 'mate',
                                value: value,
                                bestMove: pvMatch ? pvMatch[1].split(' ')[0].trim() : '',
                                pv: pvMatch ? pvMatch[1].split(' ') : [],
                            };
                        }
                    }
                }

                // Best move signals end
                if (line.startsWith('bestmove')) {
                    bestMove = line.split(' ')[1].trim();
                    cleanup();

                    if (evaluation) {
                        evaluation.bestMove = bestMove;
                        resolve(evaluation);
                    } else {
                        // Fallback for immediate bestmove
                        const isBlackTurn = fen.split(' ')[1] === 'b';
                        resolve({
                            type: 'cp',
                            value: 0,
                            bestMove,
                            pv: [bestMove],
                        });
                    }
                }
            }
        };

        const cleanup = () => {
            clearTimeout(timeout);
            instance.process.stdout?.off('data', onData);
            instance.busy = false;

            // Process queue
            const next = instance.queue.shift();
            if (next) {
                this.runEvaluation(instance, next.fen, next.depth, next.resolve, next.reject);
            }
        };

        instance.process.stdout?.on('data', onData);
        instance.process.stdin?.write(`position fen ${fen}\n`);
        instance.process.stdin?.write(`go depth ${depth}\n`);
    }

    async shutdown(): Promise<void> {
        for (const instance of this.instances) {
            instance.process.stdin?.write('quit\n');
            instance.process.kill();
        }
        this.instances = [];
        this.initialized = false;
    }
}

// Singleton instance
export const stockfishPool = new StockfishPool(2);

/**
 * Evaluate a single position
 */
export async function evaluatePosition(fen: string, depth = DEFAULT_DEPTH): Promise<StockfishEval> {
    return stockfishPool.evaluate(fen, depth);
}

/**
 * Analyze a full game from PGN
 */
export async function analyzeGame(
    pgn: string,
    userColor: 'white' | 'black',
    depth = DEFAULT_DEPTH
): Promise<Array<{
    ply: number;
    moveNumber: number;
    fen: string;
    movePlayed: string;
    movePlayedUci: string;
    evaluation: StockfishEval;
    isUserMove: boolean;
}>> {
    const chess = new Chess();
    chess.loadPgn(pgn);

    const moves = chess.history({ verbose: true });
    const results: Array<{
        ply: number;
        moveNumber: number;
        fen: string;
        movePlayed: string;
        movePlayedUci: string;
        evaluation: StockfishEval;
        isUserMove: boolean;
    }> = [];

    // Reset to starting position
    chess.reset();

    for (let i = 0; i < moves.length; i++) {
        const fen = chess.fen();
        const move = moves[i];
        const isWhiteMove = i % 2 === 0;
        const isUserMove = (userColor === 'white' && isWhiteMove) ||
            (userColor === 'black' && !isWhiteMove);

        // Get evaluation before the move
        const evaluation = await evaluatePosition(fen, depth);

        results.push({
            ply: i + 1,
            moveNumber: Math.floor(i / 2) + 1,
            fen,
            movePlayed: move.san,
            movePlayedUci: move.from + move.to + (move.promotion || ''),
            evaluation,
            isUserMove,
        });

        // Make the move
        chess.move(move);
    }

    return results;
}
