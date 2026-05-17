import { useEffect, useState } from 'react';
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

interface AnalyzeAllResult {
    success: boolean;
    total: number;
    analyzed: number;
    failed?: Array<{ id: string; error: string }>;
}

interface AnalyzeAllProgress {
    running: boolean;
    total: number;
    completed: number;
    analyzed: number;
    failed: number;
    currentGameId: string;
}

export function GameList() {
    const [page, setPage] = useState(1);
    const [source, setSource] = useState<string>('');
    const [analyzed, setAnalyzed] = useState<string>('');
    const [sort, setSort] = useState('played_at:desc');
    const [analysisMessage, setAnalysisMessage] = useState('');
    const [analyzeAllProgress, setAnalyzeAllProgress] = useState<AnalyzeAllProgress | null>(null);
    const queryClient = useQueryClient();
    const [sortBy, order] = sort.split(':');

    const { data, isLoading } = useQuery<GamesResponse>({
        queryKey: ['games', page, source, analyzed, sortBy, order],
        queryFn: () => api.games.list({ page, limit: 20, source, analyzed, sortBy, order }),
    });

    const analyzeMutation = useMutation({
        mutationFn: (gameId: string) => api.analysis.trigger(gameId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['games'] });
        },
    });

    const analyzeAllMutation = useMutation<AnalyzeAllResult>({
        mutationFn: () => api.analysis.triggerAll(),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['games'] });
            if (result.failed?.length) {
                setAnalysisMessage(`Analyzed ${result.analyzed} of ${result.total} games. ${result.failed.length} failed.`);
            } else {
                setAnalysisMessage(`Analyzed ${result.analyzed} games.`);
            }
        },
        onError: (error: any) => {
            setAnalysisMessage(error?.message || 'Analyze all failed.');
        },
    });

    useEffect(() => {
        if (!analyzeAllMutation.isPending) return;

        let cancelled = false;
        const loadProgress = async () => {
            const progress = await api.analysis.getAnalyzeAllProgress();
            if (!cancelled) {
                setAnalyzeAllProgress(progress);
            }
        };

        loadProgress();
        const interval = window.setInterval(loadProgress, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [analyzeAllMutation.isPending]);

    const progressPercent = analyzeAllProgress?.total
        ? Math.round((analyzeAllProgress.completed / analyzeAllProgress.total) * 100)
        : 0;

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

                <select
                    className="input filter-select"
                    value={sort}
                    onChange={(e) => { setSort(e.target.value); setPage(1); }}
                >
                    <option value="played_at:desc">Newest first</option>
                    <option value="played_at:asc">Oldest first</option>
                    <option value="opening_eco:asc">Opening A-Z</option>
                    <option value="opening_eco:desc">Opening Z-A</option>
                    <option value="result:asc">Result A-Z</option>
                    <option value="result:desc">Result Z-A</option>
                </select>

                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setAnalysisMessage('');
                        analyzeAllMutation.mutate();
                    }}
                    disabled={analyzeAllMutation.isPending || analyzeMutation.isPending}
                >
                    {analyzeAllMutation.isPending ? 'Analyzing...' : 'Analyze All'}
                </button>
            </div>

            {analysisMessage && (
                <div className="analysis-message card">
                    {analysisMessage}
                </div>
            )}

            {analyzeAllMutation.isPending && analyzeAllProgress && (
                <div className="analyze-progress card">
                    <div className="analyze-progress-header">
                        <span>Analyzing games</span>
                        <span>{analyzeAllProgress.completed} / {analyzeAllProgress.total}</span>
                    </div>
                    <div className="analyze-progress-track">
                        <div
                            className="analyze-progress-fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="analyze-progress-meta">
                        <span>{progressPercent}% complete</span>
                        {analyzeAllProgress.failed > 0 && (
                            <span>{analyzeAllProgress.failed} failed</span>
                        )}
                    </div>
                </div>
            )}

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
