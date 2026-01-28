// API abstraction for Electron IPC
const isElectron = !!(window as any).electron;

export const api = {
    games: {
        importChessCom: (username: string, limit?: number) =>
            isElectron ? (window as any).electron.api.importChessCom(username, limit) : Promise.reject('IPC not available'),
        importLichess: (username: string, limit?: number) =>
            isElectron ? (window as any).electron.api.importLichess(username, limit) : Promise.reject('IPC not available'),
        list: (query: any) =>
            isElectron ? (window as any).electron.api.listGames(query) : Promise.reject('IPC not available'),
        get: (id: string) =>
            isElectron ? (window as any).electron.api.getGame(id) : Promise.reject('IPC not available'),
    },
    analysis: {
        trigger: (id: string, depth?: number) =>
            isElectron ? (window as any).electron.api.triggerAnalysis(id, depth) : Promise.reject('IPC not available'),
        get: (id: string) =>
            isElectron ? (window as any).electron.api.getAnalysis(id) : Promise.reject('IPC not available'),
    },
    insights: {
        getOverview: () =>
            isElectron ? (window as any).electron.api.getOverview() : Promise.reject('IPC not available'),
        getOpenings: (minGames?: number) =>
            isElectron ? (window as any).electron.api.getOpenings(minGames) : Promise.reject('IPC not available'),
        getBlunders: () =>
            isElectron ? (window as any).electron.api.getBlunders() : Promise.reject('IPC not available'),
        getProgress: () =>
            isElectron ? (window as any).electron.api.getProgress() : Promise.reject('IPC not available'),
    }
};
