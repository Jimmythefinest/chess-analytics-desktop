# Chess Analytics Engine

A high-performance web-based chess analytics engine to identify blunders, analyze openings, and provide insights on your chess games.

![Chess Analytics](https://img.shields.io/badge/Chess-Analytics-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![React](https://img.shields.io/badge/React-18-blue)

## Features

- 🎮 **Import Games** - Connect Chess.com or Lichess accounts
- 🔍 **Blunder Detection** - Stockfish-powered analysis identifies blunders, mistakes, and inaccuracies
- 📊 **Opening Analysis** - See your win rate and blunder frequency by opening
- 📈 **Progress Tracking** - Monitor improvement over time
- ⚡ **Fast** - Background processing with worker pools

## Quick Start

### Prerequisites

- Node.js 18+
- Stockfish (for analysis)

```bash
# Install Stockfish (Ubuntu/Debian)
sudo apt install stockfish

# Install Stockfish (macOS)
brew install stockfish
```

### Installation

```bash
# Clone and install
cd chess_analytics

# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. **Import Games** - Go to Import tab, enter your Chess.com or Lichess username
2. **View Games** - Browse your imported games in the Games tab
3. **Analyze** - Click "Analyze" on any game to run Stockfish analysis
4. **Review** - Click into a game to see move-by-move blunder analysis
5. **Insights** - Check the Dashboard for overall statistics

## Project Structure

```
chess_analytics/
├── backend/           # Express + TypeScript API
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Chess.com, Lichess, Stockfish
│   │   └── db/        # SQLite database
│   └── data/          # Database files
└── frontend/          # React + Vite
    └── src/
        └── components/ # Dashboard, GameList, etc.
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games/import/chesscom/:username` | Import Chess.com games |
| POST | `/api/games/import/lichess/:username` | Import Lichess games |
| GET | `/api/games` | List games (paginated) |
| GET | `/api/games/:id` | Get single game |
| POST | `/api/analysis/game/:id` | Analyze a game |
| GET | `/api/insights/overview` | Dashboard stats |
| GET | `/api/insights/openings` | Opening performance |
| GET | `/api/insights/blunders` | Blunder patterns |

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, SQLite, Stockfish
- **Frontend**: React, Vite, TypeScript, Recharts, TanStack Query
- **Analysis**: chess.js for PGN parsing, Stockfish for evaluation

## License

MIT
