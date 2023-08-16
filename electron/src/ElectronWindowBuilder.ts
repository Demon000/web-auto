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
import { WebConfig } from '@web-auto/web-config';
import * as url from 'node:url';
import { WebConfigCommuncationChannel } from './config-ipc';
import { WebConfigMainMethod } from '@web-auto/electron-ipc-web-config';

export interface ElectronWindowConfig {
    name: string;
    display?:
        | {
              id: number;
          }
        | {
              label: string;
          };
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    app: {
        name: 'web';
        config: WebConfig;
    };
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

    public logDisplays(): void {
        const displays = screen.getAllDisplays();
        console.log('Displays', displays);
    }

    public createWebWindow(
        window: BrowserWindow,
        config: ElectronWindowConfig,
    ): void {
        const androidAutoChannel = new AndroidAutoCommuncationChannel(window);
        const webConfigChannel = new WebConfigCommuncationChannel(window);

        assert(this.androidAutoServiceFactory);
        assert(this.androidAutoServer);

        androidAutoChannel.on(AndroidAutoMainMethod.START, () => {
            assert(this.androidAutoServer);
            this.androidAutoServer.start();
        });

        webConfigChannel.on(WebConfigMainMethod.CONFIG, () => {
            return Promise.resolve(config.app.config);
        });

        this.androidAutoServiceFactory.emitter.on(
            ElectronVideoServiceEvent.DATA,
            (buffer: DataBuffer) => {
                androidAutoChannel.send(
                    AndroidAutoRendererMethod.VIDEO_DATA,
                    buffer.data,
                );
            },
        );
    }

    public async buildWindow(config: ElectronWindowConfig): Promise<void> {
        const preloadPath = path.join(__dirname, `${config.app}-preload.js`);

        const displays = screen.getAllDisplays();
        let display;

        if (config.display === undefined) {
            display = screen.getPrimaryDisplay();
        } else {
            for (const possibleDisplay of displays) {
                if (
                    ('id' in config.display &&
                        possibleDisplay.id === config.display.id) ||
                    ('label' in config.display &&
                        possibleDisplay.label === config.display.label)
                ) {
                    display = possibleDisplay;
                    break;
                }
            }

            if (display === undefined) {
                console.error(
                    `Failed to find display with id ${config.display}`,
                );
            }
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

        switch (config.app.name) {
            case 'web':
                this.createWebWindow(window, config);
                break;
            default:
                throw new Error(`Unknown app name ${config.app.name}`);
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
