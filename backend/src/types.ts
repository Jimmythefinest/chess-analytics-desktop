export interface Game {
    id: string;
    source: 'chesscom' | 'lichess' | 'pgn';
    pgn: string;
    white_player: string;
    black_player: string;
    user_color: 'white' | 'black';
    result: '1-0' | '0-1' | '1/2-1/2' | '*';
    time_control: string;
    opening_eco: string;
    opening_name: string;
    played_at: string;
    imported_at: string;
    analyzed: boolean;
}

export interface MoveAnalysis {
    id?: number;
    game_id: string;
    move_number: number;
    ply: number;
    fen: string;
    move_played: string;
    best_move: string;
    eval_before: number;
    eval_after: number;
    cp_loss: number;
    classification: 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'excellent' | 'great' | 'best' | 'brilliant';
    is_user_move: boolean;
}

export interface ChessComGame {
    url: string;
    pgn: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    white: { username: string; result: string };
    black: { username: string; result: string };
}

export interface LichessGame {
    id: string;
    pgn: string;
    speed: string;
    createdAt: number;
    players: {
        white: { user?: { name: string } };
        black: { user?: { name: string } };
    };
    winner?: 'white' | 'black';
    status: string;
    opening?: { eco: string; name: string };
}

export interface StockfishEval {
    type: 'cp' | 'mate';
    value: number;
    bestMove: string;
    pv: string[];
}

export interface InsightsOverview {
    totalGames: number;
    analyzedGames: number;
    winRate: number;
    blunderRate: number;
    averageAccuracy: number;
    mostPlayedOpening: { eco: string; name: string; count: number };
    recentTrend: 'improving' | 'declining' | 'stable';
}

export interface OpeningStats {
    eco: string;
    name: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    avgBlunders: number;
    winRate: number;
}
