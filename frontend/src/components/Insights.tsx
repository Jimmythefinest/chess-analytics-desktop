import { useQuery } from '@tanstack/react-query';
import {
    Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { api } from '../api';
import './Insights.css';

interface AdvancedInsights {
    accuracyByTime: Array<{ timeControl: string; games: number; moves: number; accuracy: number; blunderRate: number }>;
    piecePerformance: Array<{ piece: string; moves: number; accuracy: number; blunders: number; mistakes: number }>;
    openingInsights: Array<{ eco: string; name: string; games: number; winRate: number; accuracy: number; blunderRate: number }>;
    recommendations: string[];
    movesToAvoid: Array<{ eco: string; name: string; move: string; classification: string; count: number; avgLoss: number }>;
    missedForks: Array<{ piece: string; count: number; examples: string[] }>;
    hangingPieces: Array<{ piece: string; count: number; avgLoss: number }>;
}

export function Insights() {
    const { data, isLoading } = useQuery<AdvancedInsights>({
        queryKey: ['insights', 'advanced'],
        queryFn: () => api.insights.getAdvanced(),
    });

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    const hasAnalysis = !!data && (
        data.accuracyByTime.length > 0 ||
        data.piecePerformance.length > 0 ||
        data.openingInsights.length > 0
    );

    if (!hasAnalysis) {
        return (
            <div className="insights-page animate-fade-in">
                <header className="page-header">
                    <h1>Insights</h1>
                    <p className="text-secondary">Analyze games to unlock performance patterns and recommendations</p>
                </header>
                <div className="empty-state card">
                    <h3>No analyzed games yet</h3>
                    <p className="text-secondary">Run analysis from the Games page to populate tactical and opening insights.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="insights-page animate-fade-in">
            <header className="page-header">
                <h1>Insights</h1>
                <p className="text-secondary">Accuracy, opening choices, and tactical patterns from your analyzed games</p>
            </header>

            <section className="insights-grid">
                <div className="card insight-card">
                    <div className="card-header">
                        <h3 className="card-title">Accuracy By Time Control</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.accuracyByTime}>
                            <CartesianGrid stroke="#30363d" vertical={false} />
                            <XAxis dataKey="timeControl" tick={{ fill: '#8b949e' }} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#8b949e' }} />
                            <Tooltip contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: '8px' }} />
                            <Bar dataKey="accuracy" fill="#3fb950" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card insight-card">
                    <div className="card-header">
                        <h3 className="card-title">Piece-Level Accuracy</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.piecePerformance} layout="vertical" margin={{ left: 30 }}>
                            <CartesianGrid stroke="#30363d" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8b949e' }} />
                            <YAxis dataKey="piece" type="category" tick={{ fill: '#8b949e' }} width={70} />
                            <Tooltip contentStyle={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: '8px' }} />
                            <Bar dataKey="accuracy" fill="#58a6ff" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="card insight-card">
                <div className="card-header">
                    <h3 className="card-title">Opening Performance</h3>
                </div>
                <div className="insight-table-wrap">
                    <table className="table insight-table">
                        <thead>
                            <tr>
                                <th>Opening</th>
                                <th>Games</th>
                                <th>Win Rate</th>
                                <th>Accuracy</th>
                                <th>Blunder Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.openingInsights.slice(0, 10).map(opening => (
                                <tr key={opening.eco}>
                                    <td>
                                        <span className="opening-code">{opening.eco}</span>
                                        <span>{opening.name || 'Unknown'}</span>
                                    </td>
                                    <td>{opening.games}</td>
                                    <td>{opening.winRate}%</td>
                                    <td>{opening.accuracy}%</td>
                                    <td>{opening.blunderRate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="insights-grid">
                <div className="card insight-card">
                    <div className="card-header">
                        <h3 className="card-title">Missed Fork Patterns</h3>
                    </div>
                    <div className="pattern-list">
                        {data.missedForks.length > 0 ? data.missedForks.map(item => (
                            <div className="pattern-row" key={item.piece}>
                                <div>
                                    <strong>{item.piece}</strong>
                                    <p className="text-secondary">{item.examples.join(', ')}</p>
                                </div>
                                <span>{item.count}</span>
                            </div>
                        )) : <p className="text-secondary">No clear missed fork pattern yet.</p>}
                    </div>
                </div>

                <div className="card insight-card">
                    <div className="card-header">
                        <h3 className="card-title">Pieces That Usually Hang</h3>
                    </div>
                    <div className="pattern-list">
                        {data.hangingPieces.length > 0 ? data.hangingPieces.map(item => (
                            <div className="pattern-row" key={item.piece}>
                                <div>
                                    <strong>{item.piece}</strong>
                                    <p className="text-secondary">Average loss {item.avgLoss} cp</p>
                                </div>
                                <span>{item.count}</span>
                            </div>
                        )) : <p className="text-secondary">No repeated hanging-piece pattern yet.</p>}
                    </div>
                </div>
            </section>

            <section className="card insight-card">
                <div className="card-header">
                    <h3 className="card-title">Moves To Avoid By Opening</h3>
                </div>
                <div className="pattern-list">
                    {data.movesToAvoid.length > 0 ? data.movesToAvoid.map(item => (
                        <div className="pattern-row" key={`${item.eco}-${item.move}-${item.classification}`}>
                            <div>
                                <strong>{item.eco} {item.move}</strong>
                                <p className="text-secondary">
                                    {item.name || 'Unknown opening'} · repeated {item.classification} · average loss {Math.round(item.avgLoss)} cp
                                </p>
                            </div>
                            <span>{item.count}</span>
                        </div>
                    )) : <p className="text-secondary">No repeated opening move mistakes yet.</p>}
                </div>
            </section>

            <section className="card insight-card">
                <div className="card-header">
                    <h3 className="card-title">Action Plan</h3>
                </div>
                <div className="tips-list">
                    {(data.recommendations.length > 0 ? data.recommendations : ['Analyze more games to generate opening and tactic recommendations.']).map((tip, index) => (
                        <div className="tip-row" key={index}>
                            <span>{index + 1}</span>
                            <p>{tip}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
