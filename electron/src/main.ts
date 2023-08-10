import { app, protocol, BrowserWindow } from 'electron';
import * as path from 'node:path';
import * as url from 'node:url';

const indexPath = require.resolve('@web-auto/client');
const appPath = path.dirname(indexPath);
const preloadPath = path.join(__dirname, 'preload.js');
const indexUrl = url.format({
    pathname: indexPath,
    protocol: 'file',
    slashes: true,
});

function createWindow() {
    const window = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    window.loadURL(indexUrl);

    window.webContents.openDevTools();
}

app.whenReady().then(() => {
    protocol.interceptFileProtocol('file', (request, callback) => {
        let url = request.url;
        url = url.substring(7);
        if (!url.startsWith(appPath)) {
            url = path.join(appPath, url);
        }

        callback({ path: url });
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
