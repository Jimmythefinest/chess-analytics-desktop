import axios from 'axios';
import type { LichessGame } from '../types.js';

const BASE_URL = 'https://lichess.org/api';

/**
 * Fetch games for a Lichess user
 * Uses NDJSON streaming for efficiency
 */
export async function fetchGames(
    username: string,
    options: { limit?: number; since?: number } = {}
): Promise<LichessGame[]> {
    const { limit = 500, since } = options;

    const params = new URLSearchParams({
        max: limit.toString(),
        pgnInJson: 'true',
        opening: 'true',
        clocks: 'false',
        evals: 'false',
    });

    if (since) {
        params.set('since', since.toString());
    }

    const url = `${BASE_URL}/games/user/${username}?${params}`;

    const response = await axios.get(url, {
        headers: {
            'Accept': 'application/x-ndjson',
        },
        responseType: 'text',
    });

    // Parse NDJSON
    const games: LichessGame[] = response.data
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => JSON.parse(line));

    return games;
}

/**
 * Parse result from Lichess game
 */
export function parseResult(game: LichessGame): '1-0' | '0-1' | '1/2-1/2' | '*' {
    if (game.winner === 'white') return '1-0';
    if (game.winner === 'black') return '0-1';
    if (game.status === 'draw' || game.status === 'stalemate') return '1/2-1/2';
    return '*';
}

/**
 * Get player name from Lichess game
 */
export function getPlayerName(game: LichessGame, color: 'white' | 'black'): string {
    return game.players[color].user?.name || 'Anonymous';
}

/**
 * Generate unique game ID
 */
export function generateGameId(game: LichessGame): string {
    return `lichess_${game.id}`;
}

/**
 * Get time control string
 */
export function getTimeControl(game: LichessGame): string {
    return game.speed || 'unknown';
}
