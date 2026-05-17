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
        triggerAllAnalysis: (depth) => ipcRenderer.invoke('analysis:triggerAll', depth),
        getAnalyzeAllProgress: () => ipcRenderer.invoke('analysis:getAnalyzeAllProgress'),
        getAnalysis: (id) => ipcRenderer.invoke('analysis:get', id),

        // Insights
        getOverview: () => ipcRenderer.invoke('insights:overview'),
        getOpenings: (minGames) => ipcRenderer.invoke('insights:openings', minGames),
        getBlunders: () => ipcRenderer.invoke('insights:blunders'),
        getProgress: () => ipcRenderer.invoke('insights:progress'),
        getAdvancedInsights: () => ipcRenderer.invoke('insights:advanced'),

        // Explorer
        getExplorerPosition: (fen) => ipcRenderer.invoke('explorer:position', fen),

        // Window
        minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
        toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggleMaximize'),
        closeWindow: () => ipcRenderer.invoke('window:close'),
    }
});
