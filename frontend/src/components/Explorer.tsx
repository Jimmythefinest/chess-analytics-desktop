import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import 'chessboard-element';
import { api } from '../api';
import './Explorer.css';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'chess-board': any;
        }
    }
}

interface ExplorerMove {
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
    winRate: number;
    drawRate: number;
    lossRate: number;
}

interface ExplorerPosition {
    fen: string;
    positionKey: string;
    sideToMove: 'white' | 'black';
    moveNumber: number;
    games: number;
    nextMoves: ExplorerMove[];
}

interface HistoryEntry {
    fen: string;
    label: string;
}

export function Explorer() {
    const [fen, setFen] = useState('start');
    const [history, setHistory] = useState<HistoryEntry[]>([{ fen: 'start', label: 'Start' }]);

    const { data, isLoading, isError } = useQuery<ExplorerPosition>({
        queryKey: ['explorer', fen],
        queryFn: () => api.explorer.getPosition(fen),
    });

    const goToMove = (move: ExplorerMove) => {
        setFen(move.fenAfter);
        setHistory(items => [...items, { fen: move.fenAfter, label: move.san }]);
    };

    const jumpTo = (index: number) => {
        const nextHistory = history.slice(0, index + 1);
        setHistory(nextHistory);
        setFen(nextHistory[nextHistory.length - 1].fen);
    };

    const goBack = () => {
        if (history.length <= 1) return;
        jumpTo(history.length - 2);
    };

    const reset = () => {
        setFen('start');
        setHistory([{ fen: 'start', label: 'Start' }]);
    };

    const currentPly = Math.max(0, history.length - 1);
    const sideToMove = data?.sideToMove === 'black' ? 'Black' : 'White';

    return (
        <div className="explorer-page animate-fade-in">
            <header className="page-header explorer-header">
                <div>
                    <h1>Explorer</h1>
                    <p className="text-secondary">Browse your imported games as a move tree with result rates from each position.</p>
                </div>
                <div className="explorer-actions">
                    <button className="btn btn-secondary" onClick={goBack} disabled={history.length <= 1}>Back</button>
                    <button className="btn btn-secondary" onClick={reset}>Reset</button>
                </div>
            </header>

            <div className="explorer-layout">
                <section className="explorer-board-panel">
                    <div className="explorer-board-wrap">
                        <chess-board
                            key={data?.fen || fen}
                            position={data?.fen || fen}
                            draggable="false"
                        ></chess-board>
                    </div>

                    <div className="explorer-position-strip">
                        <div>
                            <span className="strip-label">To move</span>
                            <strong>{sideToMove}</strong>
                        </div>
                        <div>
                            <span className="strip-label">Move</span>
                            <strong>{data?.moveNumber || 1}</strong>
                        </div>
                        <div>
                            <span className="strip-label">Ply</span>
                            <strong>{currentPly}</strong>
                        </div>
                    </div>

                    <div className="explorer-line">
                        <div className="line-scroll">
                            {history.map((item, index) => (
                                <button
                                    key={`${item.fen}-${index}`}
                                    className={`line-chip ${index === history.length - 1 ? 'active' : ''}`}
                                    type="button"
                                    onClick={() => jumpTo(index)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="explorer-moves-panel">
                    <div className="card-header explorer-card-header">
                        <div>
                            <h3 className="card-title">Next Moves</h3>
                            <p className="text-secondary">{data?.games || 0} matching games</p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="loading-container compact">
                            <div className="spinner" />
                        </div>
                    ) : isError ? (
                        <div className="explorer-empty">
                            Could not load this position.
                        </div>
                    ) : data && data.nextMoves.length > 0 ? (
                        <div className="move-list-explorer">
                            {data.nextMoves.map(move => (
                                <button
                                    key={move.uci}
                                    className="explorer-move-row"
                                    type="button"
                                    onClick={() => goToMove(move)}
                                >
                                    <span className="move-main">
                                        <strong>{move.san}</strong>
                                        <span>{move.games} {move.games === 1 ? 'game' : 'games'}</span>
                                    </span>
                                    <span className="result-bar" aria-hidden="true">
                                        <span className="result-win" style={{ width: `${move.winRate}%` }} />
                                        <span className="result-draw" style={{ width: `${move.drawRate}%` }} />
                                        <span className="result-loss" style={{ width: `${move.lossRate}%` }} />
                                    </span>
                                    <span className="result-labels">
                                        <span className="win">{move.winRate}% W</span>
                                        <span>{move.drawRate}% D</span>
                                        <span className="loss">{move.lossRate}% L</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="explorer-empty">
                            No imported games reached this position.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
