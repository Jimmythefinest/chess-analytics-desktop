import axios from 'axios';
import type { ChessComGame } from '../types.js';

const BASE_URL = 'https://api.chess.com/pub';

/**
 * Fetch list of archived game months for a player
 */
export async function getPlayerArchives(username: string): Promise<string[]> {
    const url = `${BASE_URL}/player/${username}/games/archives`;
    const response = await axios.get<{ archives: string[] }>(url);
    return response.data.archives;
}

/**
 * Fetch games from a specific month archive
 */
export async function getGamesFromArchive(archiveUrl: string): Promise<ChessComGame[]> {
    const response = await axios.get<{ games: ChessComGame[] }>(archiveUrl);
    return response.data.games;
}

/**
 * Fetch all games for a player (with optional limit)
 */
export async function fetchAllGames(
    username: string,
    options: { limit?: number; months?: number } = {}
): Promise<ChessComGame[]> {
    const { limit = 500, months = 12 } = options;

    const archives = await getPlayerArchives(username);

    // Get most recent archives (reverse chronological)
    const recentArchives = archives.slice(-months).reverse();

    const allGames: ChessComGame[] = [];

    for (const archiveUrl of recentArchives) {
        if (allGames.length >= limit) break;

        try {
            const games = await getGamesFromArchive(archiveUrl);
            allGames.push(...games);

            // Respect rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`Failed to fetch archive ${archiveUrl}:`, error);
        }
    }

    return allGames.slice(0, limit);
}

/**
 * Parse result from Chess.com game
 */
export function parseResult(game: ChessComGame): '1-0' | '0-1' | '1/2-1/2' | '*' {
    const whiteResult = game.white.result;
    const blackResult = game.black.result;

    if (whiteResult === 'win') return '1-0';
    if (blackResult === 'win') return '0-1';
    if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move'].includes(whiteResult)) {
        return '1/2-1/2';
    }
    return '*';
}

/**
 * Generate unique game ID
 */
export function generateGameId(game: ChessComGame): string {
    // Extract game ID from URL or create from timestamp
    const urlParts = game.url.split('/');
    return `chesscom_${urlParts[urlParts.length - 1]}`;
}
