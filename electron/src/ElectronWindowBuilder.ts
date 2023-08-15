import { BrowserWindow, screen, session } from 'electron';
import { ElectronAndroidAutoServiceFactory } from './ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer, DataBuffer } from '@web-auto/android-auto';
import path from 'node:path';
import assert from 'node:assert';
import { AndroidAutoCommuncationChannel } from './android-auto-ipc';
import {
    AndroidAutoMainMethod,
    AndroidAutoRendererMethod,
} from '@web-auto/electron-ipc-android-auto';
import { ElectronVideoServiceEvent } from './ElectronAndroidAutoVideoService';
import * as url from 'node:url';

export interface ElectronWindowConfig {
    name: string;
    display?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    app: string;
}

export interface ElectronWindowBuilderConfig {
    openDevTools?: boolean;
    windows: ElectronWindowConfig[];
}

export class ElectronWindowBuilder {
    public constructor(
        private config: ElectronWindowBuilderConfig,
        private androidAutoServiceFactory:
            | ElectronAndroidAutoServiceFactory
            | undefined,
        private androidAutoServer: AndroidAutoServer | undefined,
    ) {}

    public createWebWindow(window: BrowserWindow): void {
        const channel = new AndroidAutoCommuncationChannel(window);

        assert(this.androidAutoServiceFactory);
        assert(this.androidAutoServer);

        channel.on(AndroidAutoMainMethod.START, () => {
            assert(this.androidAutoServer);
            this.androidAutoServer.start();
        });

        this.androidAutoServiceFactory.emitter.on(
            ElectronVideoServiceEvent.DATA,
            (buffer: DataBuffer) => {
                channel.send(AndroidAutoRendererMethod.VIDEO_DATA, buffer.data);
            },
        );
    }

    public async buildWindow(config: ElectronWindowConfig): Promise<void> {
        const preloadPath = path.join(__dirname, `${config.app}-preload.js`);

        let display;

        if (config.display === undefined) {
            display = screen.getPrimaryDisplay();
        }
        if (display === undefined) {
            const cursorPoint = screen.getCursorScreenPoint();
            display = screen.getDisplayNearestPoint(cursorPoint);
        }

        assert(display !== undefined);

        if (config.width === undefined) {
            config.width = display.workAreaSize.width;
        }

        if (config.height === undefined) {
            config.height = display.workAreaSize.height;
        }

        if (config.x === undefined) {
            config.x = display.bounds.x;
        }

        if (config.y === undefined) {
            config.y = display.bounds.y;
        }

        const ses = session.fromPartition(`persist:${config.name}`);
        const window = new BrowserWindow({
            width: config.width,
            height: config.height,
            x: config.x,
            y: config.y,
            fullscreen: true,
            webPreferences: {
                preload: preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                session: ses,
            },
        });

        if (config.app === 'web') {
            this.createWebWindow(window);
        }

        const indexPath = require.resolve(`@web-auto/${config.app}`);
        const appPath = path.dirname(indexPath);
        const indexUrl = url.format({
            pathname: indexPath,
            protocol: 'file',
            slashes: true,
        });

        ses.protocol.interceptFileProtocol('file', (request, callback) => {
            let url = request.url;
            url = url.substring(7);
            if (!url.startsWith(appPath)) {
                url = path.join(appPath, url);
            }

            callback({ path: url });
        });

        await window.loadURL(indexUrl);

        if (this.config.openDevTools) {
            window.webContents.openDevTools();
        }
    }

    public buildWindows(): void {
        for (const windowConfig of this.config.windows) {
            this.buildWindow(windowConfig).catch((e) => console.log(e));
        }
    }
}
