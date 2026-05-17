# Graph Report - chess-analytics-desktop  (2026-05-17)

## Corpus Check
- 37 files · ~2,242,570 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 370 nodes · 461 edges · 21 communities (19 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `850250f0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 17 edges
2. `compilerOptions` - 16 edges
3. `dependencies` - 12 edges
4. `compilerOptions` - 11 edges
5. `dependencies` - 11 edges
6. `devDependencies` - 10 edges
7. `GameReview()` - 10 edges
8. `devDependencies` - 10 edges
9. `dependencies` - 9 edges
10. `api` - 9 edges

## Surprising Connections (you probably didn't know these)
- `importLichessGames()` --calls--> `getDb()`  [EXTRACTED]
  backend/src/ipcHandlers.ts → backend/src/db/init.ts
- `listGames()` --calls--> `getDb()`  [EXTRACTED]
  backend/src/ipcHandlers.ts → backend/src/db/init.ts
- `getInsightsOverview()` --calls--> `getDb()`  [EXTRACTED]
  backend/src/ipcHandlers.ts → backend/src/db/init.ts
- `getOpeningsStats()` --calls--> `getDb()`  [EXTRACTED]
  backend/src/ipcHandlers.ts → backend/src/db/init.ts
- `getBlundersInsights()` --calls--> `getDb()`  [EXTRACTED]
  backend/src/ipcHandlers.ts → backend/src/db/init.ts

## Communities (21 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (42): getDb(), analysis, analysisRouter, classification, db, existingAnalysis, game, insertStmt (+34 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (21): description, devDependencies, better-sqlite3, esbuild, tsx, @types/better-sqlite3, @types/cors, @types/express (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (30): BlunderData, COLORS, Dashboard(), OverviewData, Explorer(), ExplorerMove, ExplorerPosition, HistoryEntry (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (20): devDependencies, concurrently, electron, electron-builder, esbuild, @types/cors, @types/express, @types/node (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (17): __dirname, initDatabase(), analysis, changes, countResult, db, game, gameId (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (23): dependencies, axios, chess.js, chessboard-element, react, react-dom, react-router-dom, recharts (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (24): blunderOpenings, blunderStats, blunderTrend, db, gameStats, insightsRouter, monthlyPerformance, monthlyTrend (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (17): 1. **Backend Code Not Being Packaged** ⚠️ CRITICAL, 2. **Stockfish Spawn Error Handling** (Secondary Issue), Build .exe Issues - Root Cause Analysis & Fixes, code:block1 (❌ Failed to start integrated backend: Error [ERR_MODULE_NOT_), code:yaml (extraResources:), code:block3 (dist_electron/win-unpacked/resources/), code:block4 (Integrating backend into main process...), code:powershell (# Copy the backend code to the existing build) (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (4): file_format_version, ICD, api_version, library_path

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (13): 1. Kill the Existing Process, 2. Change the Application Port, 3. Automatically Find an Available Port (Developer Tip), code:powershell (Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningP), code:cmd (netstat -ano | findstr :3001), code:powershell (Stop-Process -Id <PID> -Force), code:env (PORT=3002), 🔍 How to Identify the Process (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (13): API Endpoints, Chess Analytics Engine, code:bash (# Install Stockfish (Ubuntu/Debian)), code:bash (# Clone and install), code:block3 (chess_analytics/), Features, Installation, License (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (12): 1. Electron-Builder Cache Corruption, 2. Native Module Incompatibility, 3. File Path Lengths (Windows), 4. Detailed Logging, code:powershell (Remove-Item -Recurse -Force $env:LOCALAPPDATA\electron-build), code:powershell ($env:DEBUG = "electron-builder"; npm run electron:build), code:powershell (Remove-Item -Recurse -Force dist_electron, frontend/dist, ba), code:powershell (Remove-Item -Recurse -Force $env:LOCALAPPDATA\electron-build) (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (11): 1. Binary Naming Convention, 2. Where to Get Binaries, 3. Bundling with Electron, 4. How the Code Finds Them, 5. Deployment Checklist, code:bash (git clone https://github.com/official-stockfish/Stockfish.gi), code:yaml (extraResources:), code:typescript (const isDev = process.env.NODE_ENV === 'development';) (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (11): dependencies, axios, better-sqlite3, bull, chess.js, cors, dotenv, express (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.1
Nodes (15): dependencies, axios, bull, chess.js, cors, dotenv, express, ioredis (+7 more)

## Knowledge Gaps
- **214 isolated node(s):** `name`, `version`, `type`, `main`, `electron:dev` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 19` to `Community 3`, `Community 20`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 20` to `Community 1`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._