import { BrowserWindow, screen, session } from 'electron';
import path from 'node:path';
import assert from 'node:assert';
import { getLogger } from '@web-auto/logging';

import { resolve } from 'import-meta-resolve';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { ElectronIpcServiceRegistry } from '@web-auto/electron-ipc/main.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        url?: string;
    };
}

export interface ElectronWindowBuilderConfig {
    openDevTools?: boolean;
    windows: ElectronWindowConfig[];
}

export class ElectronWindowBuilder {
    private logger = getLogger(this.constructor.name);

    public constructor(
        private config: ElectronWindowBuilderConfig,
        private androidAutoIpcServiceRegistry:
            | ElectronIpcServiceRegistry
            | undefined,
    ) {}

    public logDisplays(): void {
        const displays = screen.getAllDisplays();
        this.logger.info('Displays', displays);
    }

    private async loadFile(
        window: BrowserWindow,
        config: ElectronWindowConfig,
        session: Electron.Session,
    ): Promise<void> {
        const fileUrlStart = 'file://';
        const indexPath = resolve(
            `@web-auto/${config.app.name}`,
            import.meta.url,
        );

        assert(indexPath.startsWith(fileUrlStart));
        const appPath = path.dirname(indexPath).slice(fileUrlStart.length);

        session.protocol.interceptFileProtocol('file', (request, callback) => {
            let url = request.url;
            url = url.substring(7);
            if (!url.startsWith(appPath)) {
                url = path.join(appPath, url);
            }

            callback({ path: url });
        });

        await window.loadURL(indexPath);
    }

    private async loadUrl(
        window: BrowserWindow,
        config: ElectronWindowConfig,
    ): Promise<void> {
        assert(config.app.url !== undefined);
        await window.loadURL(config.app.url);
    }

    public async buildWindow(config: ElectronWindowConfig): Promise<void> {
        const preloadPath = path.join(
            __dirname,
            `${config.app.name}-preload.mjs`,
        );

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
                this.logger.error('Failed to find display', config.display);
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

        try {
            if (config.app.url === undefined) {
                await this.loadFile(window, config, ses);
            } else {
                await this.loadUrl(window, config);
            }
        } catch (err) {
            this.logger.error('Cannot load window URL', err);
            return;
        }

        if (this.config.openDevTools) {
            window.webContents.openDevTools();
        }
    }

    public buildWindows(): void {
        for (const windowConfig of this.config.windows) {
            this.buildWindow(windowConfig).catch((e) =>
                this.logger.error('Failed to build window with config', {
                    config: windowConfig,
                    err: e,
                }),
            );
        }
    }
}
