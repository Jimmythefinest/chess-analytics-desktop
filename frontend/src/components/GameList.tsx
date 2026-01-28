import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import './GameList.css';

interface Game {
    id: string;
    source: string;
    white_player: string;
    black_player: string;
    user_color: string;
    result: string;
    time_control: string;
    opening_eco: string;
    opening_name: string;
    played_at: string;
    analyzed: boolean;
}

interface GamesResponse {
    games: Game[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export function GameList() {
    const [page, setPage] = useState(1);
    const [source, setSource] = useState<string>('');
    const [analyzed, setAnalyzed] = useState<string>('');
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<GamesResponse>({
        queryKey: ['games', page, source, analyzed],
        queryFn: () => api.games.list({ page, limit: 20, source, analyzed }),
    });

    const analyzeMutation = useMutation({
        mutationFn: (gameId: string) => api.analysis.trigger(gameId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['games'] });
        },
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getResultDisplay = (game: Game) => {
        const isWin = (game.user_color === 'white' && game.result === '1-0') ||
            (game.user_color === 'black' && game.result === '0-1');
        const isLoss = (game.user_color === 'white' && game.result === '0-1') ||
            (game.user_color === 'black' && game.result === '1-0');

        if (isWin) return <span className="result-badge win">Win</span>;
        if (isLoss) return <span className="result-badge loss">Loss</span>;
        return <span className="result-badge draw">Draw</span>;
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="game-list-page animate-fade-in">
            <header className="page-header">
                <h1>Your Games</h1>
                <p className="text-secondary">Review and analyze your chess games</p>
            </header>

            {/* Filters */}
            <div className="filters">
                <select
                    className="input filter-select"
                    value={source}
                    onChange={(e) => { setSource(e.target.value); setPage(1); }}
                >
                    <option value="">All Sources</option>
                    <option value="chesscom">Chess.com</option>
                    <option value="lichess">Lichess</option>
                </select>

                <select
                    className="input filter-select"
                    value={analyzed}
                    onChange={(e) => { setAnalyzed(e.target.value); setPage(1); }}
                >
                    <option value="">All Games</option>
                    <option value="true">Analyzed</option>
                    <option value="false">Not Analyzed</option>
                </select>
            </div>

            {/* Games Table */}
            {data && data.games.length > 0 ? (
                <>
                    <div className="games-table-container">
                        <table className="table games-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Players</th>
                                    <th>Opening</th>
                                    <th>Result</th>
                                    <th>Source</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.games.map((game) => (
                                    <tr key={game.id}>
                                        <td>{formatDate(game.played_at)}</td>
                                        <td className="players-cell">
                                            <span className={game.user_color === 'white' ? 'you' : ''}>
                                                {game.white_player}
                                            </span>
                                            <span className="vs">vs</span>
                                            <span className={game.user_color === 'black' ? 'you' : ''}>
                                                {game.black_player}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="opening-eco">{game.opening_eco}</span>
                                            <span className="opening-name">{game.opening_name || 'Unknown'}</span>
                                        </td>
                                        <td>{getResultDisplay(game)}</td>
                                        <td>
                                            <span className={`source-badge ${game.source}`}>
                                                {game.source === 'chesscom' ? 'Chess.com' : 'Lichess'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/games/${game.id}`} className="btn btn-sm btn-secondary">
                                                    View
                                                </Link>
                                                {!game.analyzed && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => analyzeMutation.mutate(game.id)}
                                                        disabled={analyzeMutation.isPending}
                                                    >
                                                        {analyzeMutation.isPending ? '...' : 'Analyze'}
                                                    </button>
                                                )}
                                                {game.analyzed && (
                                                    <span className="analyzed-badge">✓ Analyzed</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination">
                        <button
                            className="btn btn-secondary"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            Previous
                        </button>
                        <span className="page-info">
                            Page {data.pagination.page} of {data.pagination.pages}
                        </span>
                        <button
                            className="btn btn-secondary"
                            disabled={page >= data.pagination.pages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </>
            ) : (
                <div className="empty-state card">
                    <div className="empty-icon">📋</div>
                    <h3>No Games Found</h3>
                    <p className="text-secondary">Import games to see them here</p>
                    <Link to="/import" className="btn btn-primary mt-md">Import Games</Link>
                </div>
            )}
        </div>
    );
}
