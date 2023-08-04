import { app, BrowserWindow } from 'electron';
import assert from 'node:assert';
import { release } from 'node:os';
import { join } from 'node:path';

process.env.DIST_ELECTRON = join(__dirname, '..');
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

let win: BrowserWindow | null = null;

async function createWindow() {
    const preload = join(__dirname, '../preload/index.js');

    win = new BrowserWindow({
        title: 'Main window',
        icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: true,
        },
    });

    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
        win.loadURL(url);
        win.webContents.openDevTools();
    } else {
        const indexHtml = join(process.env.DIST, 'index.html');
        win.loadFile(indexHtml);
    }

    win.webContents.on('did-finish-load', () => {
        assert(win);
        win.webContents.send(
            'main-process-message',
            new Date().toLocaleString(),
        );
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    win = null;
    if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        allWindows[0].focus();
    } else {
        createWindow();
    }
});
