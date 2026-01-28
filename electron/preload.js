const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    api: {
        // Games
        importChessCom: (username, limit) => ipcRenderer.invoke('games:import:chesscom', username, limit),
        importLichess: (username, limit) => ipcRenderer.invoke('games:import:lichess', username, limit),
        listGames: (query) => ipcRenderer.invoke('games:list', query),
        getGame: (id) => ipcRenderer.invoke('games:get', id),

        // Analysis
        triggerAnalysis: (id, depth) => ipcRenderer.invoke('analysis:trigger', id, depth),
        getAnalysis: (id) => ipcRenderer.invoke('analysis:get', id),

        // Insights
        getOverview: () => ipcRenderer.invoke('insights:overview'),
        getOpenings: (minGames) => ipcRenderer.invoke('insights:openings', minGames),
        getBlunders: () => ipcRenderer.invoke('insights:blunders'),
        getProgress: () => ipcRenderer.invoke('insights:progress'),
    }
});
