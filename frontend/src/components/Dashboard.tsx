import { useQuery } from '@tanstack/react-query';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { api } from '../api';
import './Dashboard.css';

interface OverviewData {
    totalGames: number;
    analyzedGames: number;
    winRate: number;
    blunderRate: number;
    averageAccuracy: number;
    mostPlayedOpening: { eco: string; name: string; count: number };
    recentTrend: 'improving' | 'declining' | 'stable';
}

interface BlunderData {
    byPhase: { phase: string; count: number }[];
    byOpening: { eco: string; name: string; blunders: number }[];
    monthlyTrend: { month: string; blunders: number; gameCount: number }[];
}

const COLORS = ['#f85149', '#d29922', '#58a6ff', '#3fb950'];

export function Dashboard() {
    const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
        queryKey: ['insights', 'overview'],
        queryFn: () => api.insights.getOverview(),
    });

    const { data: blunders } = useQuery<BlunderData>({
        queryKey: ['insights', 'blunders'],
        queryFn: () => api.insights.getBlunders(),
    });

    const { data: progress } = useQuery({
        queryKey: ['insights', 'progress'],
        queryFn: () => api.insights.getProgress(),
    });

    if (loadingOverview) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    const hasData = overview && overview.totalGames > 0;

    return (
        <div className="dashboard animate-fade-in">
            <header className="dashboard-header">
                <h1>Dashboard</h1>
                <p className="text-secondary">Your chess performance at a glance</p>
            </header>

            {!hasData ? (
                <div className="empty-state card">
                    <div className="empty-icon">♟</div>
                    <h3>No Games Yet</h3>
                    <p className="text-secondary">Import your games from Chess.com or Lichess to get started</p>
                    <a href="/import" className="btn btn-primary mt-md">Import Games</a>
                </div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">🎮</div>
                            <div className="stat-content">
                                <div className="stat-value">{overview.totalGames}</div>
                                <div className="stat-label">Total Games</div>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">🎯</div>
                            <div className="stat-content">
                                <div className="stat-value">{overview.winRate}%</div>
                                <div className="stat-label">Win Rate</div>
                            </div>
                        </div>

                        <div className="stat-card accent-danger">
                            <div className="stat-icon">💥</div>
                            <div className="stat-content">
                                <div className="stat-value">{overview.blunderRate}%</div>
                                <div className="stat-label">Blunder Rate</div>
                            </div>
                        </div>

                        <div className="stat-card accent-success">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                                <div className="stat-value">{overview.averageAccuracy}%</div>
                                <div className="stat-label">Avg Accuracy</div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="charts-grid">
                        {/* Blunders by Phase */}
                        <div className="card chart-card">
                            <div className="card-header">
                                <h3 className="card-title">Blunders by Game Phase</h3>
                            </div>
                            <div className="chart-container">
                                {blunders?.byPhase && blunders.byPhase.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={blunders.byPhase}
                                                dataKey="count"
                                                nameKey="phase"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label={({ phase, percent }) =>
                                                    `${phase} ${(percent * 100).toFixed(0)}%`
                                                }
                                            >
                                                {blunders.byPhase.map((_, index) => (
                                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="no-data">Analyze games to see blunder breakdown</div>
                                )}
                            </div>
                        </div>

                        {/* Win Rate Trend */}
                        <div className="card chart-card">
                            <div className="card-header">
                                <h3 className="card-title">Win Rate Trend</h3>
                            </div>
                            <div className="chart-container">
                                {progress?.monthlyPerformance && progress.monthlyPerformance.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={progress.monthlyPerformance}>
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fill: '#8b949e', fontSize: 12 }}
                                                axisLine={{ stroke: '#30363d' }}
                                            />
                                            <YAxis
                                                tick={{ fill: '#8b949e', fontSize: 12 }}
                                                axisLine={{ stroke: '#30363d' }}
                                                domain={[0, 100]}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: '#1c2128',
                                                    border: '1px solid #30363d',
                                                    borderRadius: '8px'
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="winRate"
                                                stroke="#3fb950"
                                                strokeWidth={2}
                                                dot={{ fill: '#3fb950', strokeWidth: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="no-data">Not enough data for trend analysis</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Blunder Openings */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">🚨 Openings Where You Blunder Most</h3>
                        </div>
                        {blunders?.byOpening && blunders.byOpening.length > 0 ? (
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart
                                        data={blunders.byOpening.slice(0, 8)}
                                        layout="vertical"
                                        margin={{ left: 100 }}
                                    >
                                        <XAxis type="number" tick={{ fill: '#8b949e' }} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tick={{ fill: '#8b949e', fontSize: 11 }}
                                            width={100}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: '#1c2128',
                                                border: '1px solid #30363d',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Bar dataKey="blunders" fill="#f85149" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-secondary">Analyze games to identify problematic openings</p>
                        )}
                    </div>

                    {/* Most Played Opening */}
                    <div className="card highlight-card">
                        <div className="highlight-content">
                            <span className="highlight-label">Most Played Opening</span>
                            <span className="highlight-value">
                                {overview.mostPlayedOpening.eco} - {overview.mostPlayedOpening.name}
                            </span>
                            <span className="highlight-count">
                                {overview.mostPlayedOpening.count} games
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
