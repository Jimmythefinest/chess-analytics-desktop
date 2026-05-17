import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chess } from 'chess.js';
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

interface EngineEval {
    type: 'cp' | 'mate';
    value: number;
    bestMove: string;
    pv: string[];
    depth: number;
    fen: string;
}

interface HistoryEntry {
    fen: string;
    label: string;
}

function evalToPercent(evalData?: EngineEval | null) {
    if (!evalData) return 50;
    if (evalData.type === 'mate') {
        return evalData.value > 0 ? 98 : 2;
    }

    const clamped = Math.max(-600, Math.min(600, evalData.value));
    return Math.round(50 + (clamped / 12));
}

function formatEval(evalData?: EngineEval | null) {
    if (!evalData) return '...';
    if (evalData.type === 'mate') {
        return `M${Math.abs(evalData.value)}`;
    }

    const pawns = evalData.value / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export function Explorer() {
    const boardRef = useRef<HTMLElement | null>(null);
    const lastDropAtRef = useRef(0);
    const [fen, setFen] = useState('start');
    const [history, setHistory] = useState<HistoryEntry[]>([{ fen: 'start', label: 'Start' }]);
    const [engineEval, setEngineEval] = useState<EngineEval | null>(null);
    const [engineError, setEngineError] = useState('');
    const [selectedSquare, setSelectedSquare] = useState('');

    const { data, isLoading, isError } = useQuery<ExplorerPosition>({
        queryKey: ['explorer', fen],
        queryFn: () => api.explorer.getPosition(fen),
    });

    const goToMove = (move: ExplorerMove) => {
        setFen(move.fenAfter);
        setHistory(items => [...items, { fen: move.fenAfter, label: move.san }]);
        setSelectedSquare('');
    };

    const jumpTo = (index: number) => {
        const nextHistory = history.slice(0, index + 1);
        setHistory(nextHistory);
        setFen(nextHistory[nextHistory.length - 1].fen);
        setSelectedSquare('');
    };

    const goBack = () => {
        if (history.length <= 1) return;
        jumpTo(history.length - 2);
    };

    const reset = () => {
        setFen('start');
        setHistory([{ fen: 'start', label: 'Start' }]);
        setSelectedSquare('');
    };

    const currentPly = Math.max(0, history.length - 1);
    const sideToMove = data?.sideToMove === 'black' ? 'Black' : 'White';
    const boardFen = data?.fen || fen;
    const whitePercent = evalToPercent(engineEval);
    const barFillPercent = 100 - whitePercent;

    const pushMove = (nextFen: string, label: string) => {
        setFen(nextFen);
        setHistory(items => [...items, { fen: nextFen, label }]);
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
            const chess = new Chess(boardFen === 'start' ? undefined : boardFen);
            const piece = chess.get(square as any);
            return !!piece && piece.color === chess.turn();
        } catch {
            return false;
        }
    };

    const tryMove = (from: string, to: string) => {
        try {
            const chess = new Chess(boardFen === 'start' ? undefined : boardFen);
            const move = chess.move({ from, to, promotion: 'q' });
            if (!move) return false;
            pushMove(chess.fen(), move.san);
            return true;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        let active = true;
        let depth = 6;

        setEngineEval(null);
        setEngineError('');

        const evaluate = async () => {
            while (active) {
                try {
                    const result = await api.explorer.evaluatePosition(boardFen, depth) as EngineEval;
                    if (!active || result.fen !== boardFen) return;
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
    }, [boardFen]);

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
                const chess = new Chess(boardFen === 'start' ? undefined : boardFen);
                const move = chess.move({ from: source, to: target, promotion: 'q' });

                if (!move) {
                    setAction('snapback');
                    return;
                }

                pushMove(chess.fen(), move.san);
            } catch {
                setAction('snapback');
            }
        };

        board.addEventListener('drop', handleDrop);
        return () => board.removeEventListener('drop', handleDrop);
    }, [boardFen]);

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

            if (tryMove(selectedSquare, square)) return;

            setSelectedSquare(isOwnPiece(square) ? square : '');
        };

        board.addEventListener('click', handleTap);
        return () => board.removeEventListener('click', handleTap);
    }, [boardFen, selectedSquare]);

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
                    <div className="explorer-board-stage">
                        <div className="eval-bar" aria-label={`Engine evaluation ${formatEval(engineEval)}`}>
                            <span className="eval-label top">{formatEval(engineEval)}</span>
                            <span className="eval-fill" style={{ height: `${barFillPercent}%` }} />
                            <span className="eval-label bottom">{engineEval ? `d${engineEval.depth}` : engineError || 'SF'}</span>
                        </div>
                        <div className="explorer-board-wrap">
                            {selectedSquare && (
                                <style>{`chess-board::part(${selectedSquare}) { box-shadow: inset 0 0 0 4px rgba(88, 166, 255, 0.85); }`}</style>
                            )}
                            <chess-board
                                ref={boardRef}
                                key={boardFen}
                                position={boardFen}
                                draggable-pieces="true"
                                drop-off-board="snapback"
                            ></chess-board>
                        </div>
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
