import dotenv from 'dotenv';
import { initDatabase } from './db/init.js';

// Export all IPC handlers
export * from './ipcHandlers.js';
export { initDatabase } from './db/init.js';

dotenv.config();

// Initialize database
async function start() {
    try {
        await initDatabase();
        console.log('✅ Backend core initialized (IPC mode)');
    } catch (error) {
        console.error('Failed to initialize backend core:', error);
    }
}

start();
