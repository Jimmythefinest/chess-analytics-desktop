import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import url from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;
let backend;

async function setupIPC() {
    console.log("Setting up IPC handlers...");
    try {
        const backendPath = path.join(__dirname, '../backend/dist/index.js');
        const backendUrl = url.pathToFileURL(backendPath).href;
        backend = await import(backendUrl);

        // Games
        ipcMain.handle('games:import:chesscom', (e, username, limit) => backend.importChessComGames(username, limit));
        ipcMain.handle('games:import:lichess', (e, username, limit) => backend.importLichessGames(username, limit));
        ipcMain.handle('games:list', (e, query) => backend.listGames(query));
        ipcMain.handle('games:get', (e, id) => backend.getGame(id));

        // Analysis
        ipcMain.handle('analysis:trigger', (e, id, depth) => backend.triggerAnalysis(id, depth));
        ipcMain.handle('analysis:get', (e, id) => backend.getGame(id)); // Same as games:get for now

        // Insights
        ipcMain.handle('insights:overview', () => backend.getInsightsOverview());
        ipcMain.handle('insights:openings', (e, minGames) => backend.getOpeningsStats(minGames));
        ipcMain.handle('insights:blunders', () => backend.getBlundersInsights());
        ipcMain.handle('insights:progress', () => backend.getProgressInsights());

        console.log("✅ IPC handlers registered.");
    } catch (error) {
        console.error("❌ Failed to set up IPC:", error);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: "Chess Analytics",
        backgroundColor: '#0d1117',
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }

    // Open DevTools in dev mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await setupIPC();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
