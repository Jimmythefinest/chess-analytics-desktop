import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { Chess } from 'chess.js';
import 'chessboard-element';
import {
    AreaChart, Area, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import './GameReview.css';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'chess-board': any;
        }
    }
}

interface MoveAnalysis {
    ply: number;
    move_number: number;
    fen: string;
    move_played: string;
    best_move: string;
    eval_before: number;
    eval_after: number;
    cp_loss: number;
    classification: string;
    is_user_move: boolean;
}

interface PlayerStats {
    totalMoves: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    excellent: number;
    good: number;
    great: number;
    best: number;
    brilliant: number;
    accuracy: number;
}

interface GameData {
    game: {
        id: string;
        pgn: string;
        white_player: string;
        black_player: string;
        user_color: string;
        result: string;
        opening_eco: string;
        opening_name: string;
        played_at: string;
    };
    analyzed: boolean;
    analysis: MoveAnalysis[];
    summary?: {
        totalMoves: number;
        user: PlayerStats;
        opponent: PlayerStats;
        gamePhaseBreakdown: any;
    };
}

interface EngineEval {
    type: 'cp' | 'mate';
    value: number;
    bestMove: string;
    pv: string[];
    depth: number;
    fen: string;
}

function evaluationToPercentage(evaluation?: EngineEval | null) {
    if (!evaluation) return 50;
    if (evaluation.type === 'mate') return evaluation.value > 0 ? 98 : 2;

    const limit = 600;
    const normalized = Math.max(-limit, Math.min(limit, evaluation.value));
    return ((normalized + limit) / (limit * 2)) * 100;
}

function formatEvaluation(evaluation?: EngineEval | null) {
    if (!evaluation) return '...';
    if (evaluation.type === 'mate') return `M${Math.abs(evaluation.value)}`;
    return `${evaluation.value >= 0 ? '+' : ''}${(evaluation.value / 100).toFixed(2)}`;
}

function EvaluationBar({ evaluation, error }: { evaluation?: EngineEval | null; error?: string }) {
    // Normalize evaluation to percentage (0 to 100)
    // -500 to +500 CP is the typical range shown
    const percentage = evaluationToPercentage(evaluation);

    return (
        <div className="evaluation-bar-container">
            <div className="evaluation-bar">
                <div
                    className="evaluation-fill white"
                    style={{
                        height: `${percentage}%`,
                    }}
                />
                <div className="evaluation-center-line" />
            </div>
            <div className="evaluation-text">
                {evaluation ? `${formatEvaluation(evaluation)} d${evaluation.depth}` : error || '...'}
            </div>
        </div>
    );
}

function EvaluationGraph({ data, onSelectMove }: {
    data: MoveAnalysis[];
    onSelectMove: (ply: number) => void
}) {
    const chartData = data.map(m => ({
        ply: m.ply,
        eval: Math.max(-500, Math.min(500, m.eval_after))
    }));

    return (
        <div className="evaluation-graph card">
            <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} onClick={(e) => e && e.activePayload && onSelectMove(e.activePayload[0].payload.ply)}>
                    <defs>
                        <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <ReferenceLine y={0} stroke="var(--bg-tertiary)" strokeDasharray="3 3" />
                    <Area
                        type="monotone"
                        dataKey="eval"
                        stroke="var(--accent-primary)"
                        fillOpacity={1}
                        fill="url(#colorEval)"
                        isAnimationActive={false}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="graph-tooltip">
                                        Move {Math.ceil(payload[0].payload.ply / 2)}: {(payload[0].value as number / 100).toFixed(1)}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function GameReview() {
    const { id } = useParams();
    const boardRef = useRef<HTMLElement | null>(null);
    const lastDropAtRef = useRef(0);
    const [currentPly, setCurrentPly] = useState(0);
    const [chess] = useState(new Chess());
    const [position, setPosition] = useState('start');
    const [customLine, setCustomLine] = useState<string[]>([]);
    const [selectedSquare, setSelectedSquare] = useState('');
    const [engineEval, setEngineEval] = useState<EngineEval | null>(null);
    const [engineError, setEngineError] = useState('');

    const { data, isLoading, refetch } = useQuery<GameData>({
        queryKey: ['analysis', 'game', id],
        queryFn: () => api.analysis.get(id!),
    });

    const analyzeMutation = useMutation({
        mutationFn: () => api.analysis.trigger(id!),
        onSuccess: () => {
            refetch();
        },
    });

    useEffect(() => {
        if (data?.game.pgn) {
            chess.loadPgn(data.game.pgn);
            const history = chess.history();
            chess.reset();

            for (let i = 0; i < currentPly; i++) {
                if (history[i]) chess.move(history[i]);
            }
            setPosition(chess.fen());
            setCustomLine([]);
            setSelectedSquare('');
        }
    }, [data, currentPly, chess]);

    useEffect(() => {
        let active = true;
        let depth = 6;

        setEngineEval(null);
        setEngineError('');

        const evaluate = async () => {
            while (active) {
                try {
                    const result = await api.explorer.evaluatePosition(position, depth) as EngineEval;
                    if (!active || result.fen !== position) return;
                    setEngineEval(result);
                    setEngineError('');
                    depth += 2;
                } catch (error: any) {
                    if (!active) return;
                    setEngineError(error?.message || 'Engine unavailable');
                    return;
                }
            }
        };

        evaluate();

        return () => {
            active = false;
        };
    }, [position]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                goToMove(currentPly + 1);
            } else if (e.key === 'ArrowLeft') {
                goToMove(currentPly - 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPly, data]);

    const goToMove = (ply: number) => {
        if (!data) return;
        const maxPly = data.analysis?.length || 0;
        setCurrentPly(Math.max(0, Math.min(ply, maxPly)));
    };

    const pushCustomMove = (nextFen: string, san: string) => {
        setPosition(nextFen);
        setCustomLine(items => [...items, san]);
        setSelectedSquare('');
    };

    const getSquareFromEvent = (event: Event) => {
        const path = event.composedPath();
        for (const item of path) {
            if (item instanceof HTMLElement) {
                const square = item.getAttribute('data-square');
                if (square) return square;
            }
        }
        return '';
    };

    const isOwnPiece = (square: string) => {
        try {
            const current = new Chess(position === 'start' ? undefined : position);
            const piece = current.get(square as any);
            return !!piece && piece.color === current.turn();
        } catch {
            return false;
        }
    };

    const tryCustomMove = (from: string, to: string) => {
        try {
            const current = new Chess(position === 'start' ? undefined : position);
            const move = current.move({ from, to, promotion: 'q' });
            if (!move) return false;
            pushCustomMove(current.fen(), move.san);
            return true;
        } catch {
            return false;
        }
    };

    const returnToGameLine = () => {
        setCustomLine([]);
        setSelectedSquare('');
        if (!data?.game.pgn) return;
        const reviewChess = new Chess();
        reviewChess.loadPgn(data.game.pgn);
        const history = reviewChess.history();
        reviewChess.reset();
        for (let i = 0; i < currentPly; i++) {
            if (history[i]) reviewChess.move(history[i]);
        }
        setPosition(reviewChess.fen());
    };

    useEffect(() => {
        const board = boardRef.current;
        if (!board) return;

        const handleDrop = (event: Event) => {
            lastDropAtRef.current = Date.now();
            const dropEvent = event as CustomEvent<{
                source: string;
                target: string;
                setAction: (action: 'snapback' | 'trash' | 'drop') => void;
            }>;
            const { source, target, setAction } = dropEvent.detail;

            if (!source || !target || target === 'offboard') {
                setAction('snapback');
                return;
            }

            try {
                const current = new Chess(position === 'start' ? undefined : position);
                const move = current.move({ from: source, to: target, promotion: 'q' });
                if (!move) {
                    setAction('snapback');
                    return;
                }
                pushCustomMove(current.fen(), move.san);
            } catch {
                setAction('snapback');
            }
        };

        board.addEventListener('drop', handleDrop);
        return () => board.removeEventListener('drop', handleDrop);
    }, [position]);

    useEffect(() => {
        const board = boardRef.current;
        if (!board) return;

        const handleTap = (event: Event) => {
            if (Date.now() - lastDropAtRef.current < 150) return;

            const square = getSquareFromEvent(event);
            if (!square) return;

            if (!selectedSquare) {
                setSelectedSquare(isOwnPiece(square) ? square : '');
                return;
            }

            if (selectedSquare === square) {
                setSelectedSquare('');
                return;
            }

            if (tryCustomMove(selectedSquare, square)) return;
            setSelectedSquare(isOwnPiece(square) ? square : '');
        };

        board.addEventListener('click', handleTap);
        return () => board.removeEventListener('click', handleTap);
    }, [position, selectedSquare]);

    const getClassBadge = (classification: string) => {
        const classes: Record<string, string> = {
            brilliant: 'badge-brilliant',
            great: 'badge-great',
            best: 'badge-best',
            excellent: 'badge-excellent',
            good: 'badge-good',
            inaccuracy: 'badge-inaccuracy',
            mistake: 'badge-mistake',
            blunder: 'badge-blunder',
        };
        return classes[classification] || 'badge-good';
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    if (!data) {
        return <div className="card">Game not found</div>;
    }

    const currentMove = data.analysis?.[currentPly - 1];

    return (
        <div className="game-review animate-fade-in">
            <Link to="/games" className="back-link">← Back to Games</Link>

            <header className="review-header">
                <div className="players-info">
                    <span className={data.game.user_color === 'white' ? 'you' : ''}>
                        {data.game.white_player}
                    </span>
                    <span className="vs">vs</span>
                    <span className={data.game.user_color === 'black' ? 'you' : ''}>
                        {data.game.black_player}
                    </span>
                </div>
                <div className="game-meta">
                    <span>{data.game.opening_eco} {data.game.opening_name}</span>
                    <span className="result">{data.game.result}</span>
                </div>
            </header>

            <div className="review-layout">
                {/* Board Section */}
                <div className="board-container">
                    <EvaluationBar
                        evaluation={engineEval}
                        error={engineError}
                    />
                    <div className="board-section">
                        <div className="chessboard-wrapper">
                            {selectedSquare && (
                                <style>{`chess-board::part(${selectedSquare}) { box-shadow: inset 0 0 0 4px rgba(88, 166, 255, 0.85); }`}</style>
                            )}
                            <chess-board
                                ref={boardRef}
                                key={position}
                                position={position}
                                orientation={data.game.user_color === 'black' ? 'black' : 'white'}
                                draggable-pieces="true"
                                drop-off-board="snapback"
                            ></chess-board>
                        </div>

                        <div className="board-controls">
                            <button className="btn btn-secondary" onClick={() => goToMove(0)}>⏮</button>
                            <button className="btn btn-secondary" onClick={() => goToMove(currentPly - 1)}>◀</button>
                            <span className="move-counter">Move {Math.ceil(currentPly / 2)} / {Math.ceil((data.analysis?.length || 0) / 2)}</span>
                            <button className="btn btn-secondary" onClick={() => goToMove(currentPly + 1)}>▶</button>
                            <button className="btn btn-secondary" onClick={() => goToMove(data.analysis?.length || 0)}>⏭</button>
                        </div>

                        {customLine.length > 0 && (
                            <div className="custom-line-panel">
                                <div className="custom-line-moves">
                                    <span className="custom-line-label">Custom</span>
                                    {customLine.map((move, index) => (
                                        <span key={`${move}-${index}`} className="custom-line-chip">{move}</span>
                                    ))}
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={returnToGameLine}>Return to game</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="analysis-section">
                    {!data.analyzed ? (
                        <div className="not-analyzed card">
                            <h3>Game Not Analyzed</h3>
                            <p className="text-secondary">Run Stockfish analysis to see move-by-move evaluation</p>
                            <button
                                className="btn btn-primary mt-md"
                                onClick={() => analyzeMutation.mutate()}
                                disabled={analyzeMutation.isPending}
                            >
                                {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Game'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Current Move Info */}
                            {currentMove && (
                                <div className="current-move card animate-slide-up">
                                    <div className="move-header">
                                        <h4>{Math.ceil(currentMove.ply / 2)}. {currentMove.move_played}</h4>
                                        <div className={`badge ${getClassBadge(currentMove.classification)}`}>
                                            {currentMove.classification}
                                        </div>
                                    </div>

                                    {currentMove.classification !== 'best' && currentMove.classification !== 'brilliant' && (
                                        <div className="best-move-suggestion">
                                            Best was <strong>{currentMove.best_move}</strong>
                                        </div>
                                    )}

                                    <div className="eval-footer">
                                        <div className="eval-score">{(currentMove.eval_after / 100).toFixed(1)}</div>
                                        {currentMove.cp_loss > 0 && (
                                            <div className="cp-loss">-{currentMove.cp_loss}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Summary */}
                            {data.summary && (
                                <div className="analysis-summary card">
                                    <div className="player-comparison">
                                        <div className="player-col">
                                            <div className="accuracy-circle">
                                                <svg viewBox="0 0 36 36">
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-tertiary)" strokeWidth="2" />
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray={`${data.summary.user.accuracy}, 100`} />
                                                </svg>
                                                <div className="accuracy-label">
                                                    <span>{data.summary.user.accuracy}%</span>
                                                    <small>YOU</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="player-col">
                                            <div className="accuracy-circle">
                                                <svg viewBox="0 0 36 36">
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-tertiary)" strokeWidth="2" />
                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeDasharray={`${data.summary.opponent.accuracy}, 100`} />
                                                </svg>
                                                <div className="accuracy-label">
                                                    <span>{data.summary.opponent.accuracy}%</span>
                                                    <small>OPP</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="classification-grid">
                                        <div className="classification-row">
                                            <span className="badge-brilliant">!!</span>
                                            <span className="count">{data.summary.user.brilliant}</span>
                                            <span className="label">Brilliant</span>
                                            <span className="count">{data.summary.opponent.brilliant}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-great">!</span>
                                            <span className="count">{data.summary.user.great}</span>
                                            <span className="label">Great</span>
                                            <span className="count">{data.summary.opponent.great}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-best">✓</span>
                                            <span className="count">{data.summary.user.best}</span>
                                            <span className="label">Best</span>
                                            <span className="count">{data.summary.opponent.best}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-excellent">+</span>
                                            <span className="count">{data.summary.user.excellent}</span>
                                            <span className="label">Excellent</span>
                                            <span className="count">{data.summary.opponent.excellent}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-good">✓</span>
                                            <span className="count">{data.summary.user.good}</span>
                                            <span className="label">Good</span>
                                            <span className="count">{data.summary.opponent.good}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-inaccuracy">?!</span>
                                            <span className="count">{data.summary.user.inaccuracies}</span>
                                            <span className="label">Inaccuracies</span>
                                            <span className="count">{data.summary.opponent.inaccuracies}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-mistake">?</span>
                                            <span className="count">{data.summary.user.mistakes}</span>
                                            <span className="label">Mistakes</span>
                                            <span className="count">{data.summary.opponent.mistakes}</span>
                                        </div>
                                        <div className="classification-row">
                                            <span className="badge-blunder">??</span>
                                            <span className="count">{data.summary.user.blunders}</span>
                                            <span className="label">Blunders</span>
                                            <span className="count">{data.summary.opponent.blunders}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <EvaluationGraph
                                data={data.analysis}
                                onSelectMove={goToMove}
                            />

                            {/* Move List */}
                            <div className="move-list card">
                                <h4>Moves</h4>
                                <div className="moves">
                                    {data.analysis?.map((move: MoveAnalysis) => (
                                        <div
                                            key={move.ply}
                                            className={`move-item ${currentPly === move.ply ? 'active' : ''} ${move.classification}`}
                                            onClick={() => goToMove(move.ply)}
                                        >
                                            <span className="move-num">{move.ply % 2 !== 0 ? Math.ceil(move.ply / 2) + '.' : ''}</span>
                                            <span className="move-san">{move.move_played}</span>
                                            {(move.classification === 'blunder' || move.classification === 'brilliant' || move.classification === 'mistake') && (
                                                <span className={`mini-indicator ${move.classification}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
