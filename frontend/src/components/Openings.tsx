import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';
import './Openings.css';

interface OpeningStats {
    eco: string;
    name: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    avgBlunders: number;
    winRate: number;
}

export function Openings() {
    const { data, isLoading } = useQuery<{ openings: OpeningStats[] }>({
        queryKey: ['insights', 'openings'],
        queryFn: () => api.insights.getOpenings(2),
    });

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    const openings = data?.openings || [];

    const getWinRateColor = (winRate: number) => {
        if (winRate >= 60) return '#3fb950';
        if (winRate >= 45) return '#d29922';
        return '#f85149';
    };

    return (
        <div className="openings-page animate-fade-in">
            <header className="page-header">
                <h1>Opening Analysis</h1>
                <p className="text-secondary">See how you perform in different openings</p>
            </header>

            {openings.length === 0 ? (
                <div className="empty-state card">
                    <div className="empty-icon">📖</div>
                    <h3>No Opening Data</h3>
                    <p className="text-secondary">Import and analyze games to see opening statistics</p>
                </div>
            ) : (
                <>
                    {/* Win Rate Chart */}
                    <div className="card mb-lg">
                        <div className="card-header">
                            <h3 className="card-title">Win Rate by Opening</h3>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart
                                    data={openings.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ left: 150, right: 30 }}
                                >
                                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8b949e' }} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tick={{ fill: '#8b949e', fontSize: 12 }}
                                        width={150}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#1c2128',
                                            border: '1px solid #30363d',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value: number) => [`${value}%`, 'Win Rate']}
                                    />
                                    <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                                        {openings.slice(0, 10).map((entry, index) => (
                                            <Cell key={index} fill={getWinRateColor(entry.winRate)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Openings Table */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">All Openings</h3>
                        </div>
                        <div className="openings-table-container">
                            <table className="table openings-table">
                                <thead>
                                    <tr>
                                        <th>ECO</th>
                                        <th>Opening</th>
                                        <th>Games</th>
                                        <th>W / D / L</th>
                                        <th>Win Rate</th>
                                        <th>Avg Blunders</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openings.map((opening) => (
                                        <tr key={opening.eco}>
                                            <td>
                                                <span className="eco-badge">{opening.eco}</span>
                                            </td>
                                            <td className="opening-name-cell">{opening.name}</td>
                                            <td>{opening.gamesPlayed}</td>
                                            <td>
                                                <span className="wdl">
                                                    <span className="text-success">{opening.wins}</span>
                                                    <span className="text-secondary"> / {opening.draws} / </span>
                                                    <span className="text-danger">{opening.losses}</span>
                                                </span>
                                            </td>
                                            <td>
                                                <div className="win-rate-bar">
                                                    <div
                                                        className="win-rate-fill"
                                                        style={{
                                                            width: `${opening.winRate}%`,
                                                            background: getWinRateColor(opening.winRate)
                                                        }}
                                                    />
                                                    <span className="win-rate-text">{opening.winRate}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={opening.avgBlunders > 1.5 ? 'text-danger' : ''}>
                                                    {opening.avgBlunders.toFixed(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
