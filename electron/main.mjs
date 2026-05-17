import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import url from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

let mainWindow;
let backend;

function getMainWindow() {
    return BrowserWindow.getFocusedWindow() || mainWindow;
}

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
        ipcMain.handle('analysis:triggerAll', (e, depth) => backend.triggerAnalysisForAll(depth));
        ipcMain.handle('analysis:getAnalyzeAllProgress', () => backend.getAnalyzeAllProgress());
        ipcMain.handle('analysis:get', (e, id) => backend.getGame(id)); // Same as games:get for now

        // Insights
        ipcMain.handle('insights:overview', () => backend.getInsightsOverview());
        ipcMain.handle('insights:openings', (e, minGames) => backend.getOpeningsStats(minGames));
        ipcMain.handle('insights:blunders', () => backend.getBlundersInsights());
        ipcMain.handle('insights:progress', () => backend.getProgressInsights());
        ipcMain.handle('insights:advanced', () => backend.getAdvancedInsights());

        // Explorer
        ipcMain.handle('explorer:position', (e, fen) => backend.getExplorerPosition(fen));

        // Window controls
        ipcMain.handle('window:minimize', () => getMainWindow()?.minimize());
        ipcMain.handle('window:toggleMaximize', () => {
            const window = getMainWindow();
            if (!window) return;
            if (window.isMaximized()) {
                window.unmaximize();
            } else {
                window.maximize();
            }
        });
        ipcMain.handle('window:close', () => getMainWindow()?.close());

        console.log("✅ IPC handlers registered.");
    } catch (error) {
        console.error("❌ Failed to set up IPC:", error);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 960,
        minHeight: 640,
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: "Chess Analytics",
        backgroundColor: '#0d1117',
    });

    mainWindow.maximize();

    if (isDev) {
        mainWindow.loadURL(devServerUrl);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
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
