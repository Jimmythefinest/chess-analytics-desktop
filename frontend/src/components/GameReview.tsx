import { useState, useEffect } from 'react';
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

function EvaluationBar({ evaluation }: { evaluation: number }) {
    // Normalize evaluation to percentage (0 to 100)
    // -500 to +500 CP is the typical range shown
    const limit = 500;
    const normalized = Math.max(-limit, Math.min(limit, evaluation));
    const percentage = ((normalized + limit) / (limit * 2)) * 100;


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
                {(evaluation / 100).toFixed(1)}
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
    const [currentPly, setCurrentPly] = useState(0);
    const [chess] = useState(new Chess());
    const [position, setPosition] = useState('start');

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
        }
    }, [data, currentPly, chess]);

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
                        evaluation={currentMove ? currentMove.eval_after : 0}
                    />
                    <div className="board-section">
                        <div className="chessboard-wrapper">
                            <chess-board
                                position={position}
                                orientation={data.game.user_color === 'black' ? 'black' : 'white'}
                                draggable="false"
                            ></chess-board>
                        </div>

                        <div className="board-controls">
                            <button className="btn btn-secondary" onClick={() => goToMove(0)}>⏮</button>
                            <button className="btn btn-secondary" onClick={() => goToMove(currentPly - 1)}>◀</button>
                            <span className="move-counter">Move {Math.ceil(currentPly / 2)} / {Math.ceil((data.analysis?.length || 0) / 2)}</span>
                            <button className="btn btn-secondary" onClick={() => goToMove(currentPly + 1)}>▶</button>
                            <button className="btn btn-secondary" onClick={() => goToMove(data.analysis?.length || 0)}>⏭</button>
                        </div>
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
