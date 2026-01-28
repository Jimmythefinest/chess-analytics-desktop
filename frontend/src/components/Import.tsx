import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import './Import.css';

interface ImportResult {
    success: boolean;
    message: string;
    total: number;
    imported: number;
}

export function Import() {
    const [chesscomUsername, setChesscomUsername] = useState('');
    const [lichessUsername, setLichessUsername] = useState('');
    const [gameLimit, setGameLimit] = useState(100);

    const chesscomMutation = useMutation<ImportResult, Error, void>({
        mutationFn: () => api.games.importChessCom(chesscomUsername, gameLimit),
    });

    const lichessMutation = useMutation<ImportResult, Error, void>({
        mutationFn: () => api.games.importLichess(lichessUsername, gameLimit),
    });

    return (
        <div className="import-page animate-fade-in">
            <header className="page-header">
                <h1>Import Games</h1>
                <p className="text-secondary">Connect your Chess.com or Lichess account to import games</p>
            </header>

            <div className="import-grid">
                {/* Chess.com */}
                <div className="import-card card">
                    <div className="import-logo chesscom">
                        <span className="logo-icon">♟</span>
                        <span className="logo-text">Chess.com</span>
                    </div>

                    <div className="import-form">
                        <label>
                            <span className="input-label">Username</span>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter Chess.com username"
                                value={chesscomUsername}
                                onChange={(e) => setChesscomUsername(e.target.value)}
                            />
                        </label>

                        <label>
                            <span className="input-label">Max Games</span>
                            <input
                                type="number"
                                className="input"
                                min="10"
                                max="1000"
                                value={gameLimit}
                                onChange={(e) => setGameLimit(Number(e.target.value))}
                            />
                        </label>

                        <button
                            className="btn btn-primary import-btn"
                            onClick={() => chesscomMutation.mutate()}
                            disabled={!chesscomUsername || chesscomMutation.isPending}
                        >
                            {chesscomMutation.isPending ? 'Importing...' : 'Import Games'}
                        </button>

                        {chesscomMutation.isSuccess && (
                            <div className="import-success">
                                ✓ {chesscomMutation.data?.message}
                            </div>
                        )}

                        {chesscomMutation.isError && (
                            <div className="import-error">
                                ✗ {chesscomMutation.error?.message || 'Import failed'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lichess */}
                <div className="import-card card">
                    <div className="import-logo lichess">
                        <span className="logo-icon">♞</span>
                        <span className="logo-text">Lichess</span>
                    </div>

                    <div className="import-form">
                        <label>
                            <span className="input-label">Username</span>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter Lichess username"
                                value={lichessUsername}
                                onChange={(e) => setLichessUsername(e.target.value)}
                            />
                        </label>

                        <label>
                            <span className="input-label">Max Games</span>
                            <input
                                type="number"
                                className="input"
                                min="10"
                                max="1000"
                                value={gameLimit}
                                onChange={(e) => setGameLimit(Number(e.target.value))}
                            />
                        </label>

                        <button
                            className="btn btn-primary import-btn"
                            onClick={() => lichessMutation.mutate()}
                            disabled={!lichessUsername || lichessMutation.isPending}
                        >
                            {lichessMutation.isPending ? 'Importing...' : 'Import Games'}
                        </button>

                        {lichessMutation.isSuccess && (
                            <div className="import-success">
                                ✓ {lichessMutation.data?.message}
                            </div>
                        )}

                        {lichessMutation.isError && (
                            <div className="import-error">
                                ✗ {lichessMutation.error?.message || 'Import failed'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="instructions card">
                <h3>How it works</h3>
                <ol>
                    <li>Enter your username from Chess.com or Lichess</li>
                    <li>Select how many games to import (max 1000)</li>
                    <li>Click Import - games will be fetched from the public API</li>
                    <li>After import, go to Games to view and analyze them</li>
                </ol>
                <p className="note">
                    <strong>Note:</strong> Only public games can be imported. Analysis uses Stockfish
                    and may take a few seconds per game.
                </p>
            </div>
        </div>
    );
}
