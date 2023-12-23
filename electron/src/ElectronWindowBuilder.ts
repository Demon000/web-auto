import {
    BrowserWindow,
    net,
    screen,
    session,
    type BrowserWindowConstructorOptions,
} from 'electron';
import { join, resolve } from 'node:path';
import assert from 'node:assert';
import { getLogger } from '@web-auto/logging';

import { fileURLToPath, pathToFileURL } from 'url';

export type ElectronWindowDisplayConfig =
    | {
          id: number;
      }
    | {
          label: string;
      };

export type ElectronWindowAppConfig = {
    preload: string;
} & (
    | {
          path: string;
          index: string;
      }
    | {
          url: string;
      }
);

export type ElectronWindowConfig = {
    name: string;
    display?: ElectronWindowDisplayConfig;
    app: ElectronWindowAppConfig;
} & (
    | {
          width?: number;
          height?: number;
          x?: number;
          y?: number;
      }
    | {
          fullscreen: boolean;
      }
);

export interface ElectronWindowBuilderConfig {
    openDevTools?: boolean;
    windows: ElectronWindowConfig[];
}

export class ElectronWindowBuilder {
    private logger = getLogger(this.constructor.name);

    public constructor(private config: ElectronWindowBuilderConfig) {}

    public logDisplays(): void {
        const displays = screen.getAllDisplays();
        this.logger.info('Displays', displays);
    }

    private async loadFile(
        window: BrowserWindow,
        config: ElectronWindowConfig,
        session: Electron.Session,
    ): Promise<void> {
        assert('path' in config.app);

        const appPath = resolve('..', config.app.path);
        const indexPath = join(appPath, config.app.index);
        const indexUrl = pathToFileURL(indexPath);

        session.protocol.handle('file', (request) => {
            const relativePath = fileURLToPath(request.url);
            let absolutePath;
            if (relativePath.startsWith(appPath)) {
                absolutePath = relativePath;
            } else {
                absolutePath = join(appPath, relativePath);
            }
            const absoluteUrl = pathToFileURL(absolutePath);
            return net.fetch(absoluteUrl.href);
        });

        await window.loadURL(indexUrl.href);
    }

    private async loadUrl(
        window: BrowserWindow,
        config: ElectronWindowConfig,
    ): Promise<void> {
        assert('url' in config.app);
        await window.loadURL(config.app.url);
    }

    public async buildWindow(config: ElectronWindowConfig): Promise<void> {
        const preloadPath = resolve('..', config.app.preload);

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

        const ses = session.fromPartition(`persist:${config.name}`);
        const options: BrowserWindowConstructorOptions = {
            useContentSize: true,
            webPreferences: {
                preload: preloadPath,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                session: ses,
            },
        };

        if ('fullscreen' in config) {
            options.fullscreen = config.fullscreen;
        } else {
            if (config.width !== undefined) {
                options.width = config.width;
            }

            if (config.height !== undefined) {
                options.height = config.height;
            }

            if (config.x !== undefined) {
                options.x = config.x;
            }

            if (config.y !== undefined) {
                options.y = config.y;
            }
        }

        const window = new BrowserWindow(options);

        try {
            if ('url' in config.app) {
                await this.loadUrl(window, config);
            } else {
                await this.loadFile(window, config, ses);
            }
        } catch (err) {
            this.logger.error('Cannot load window URL', err);
            return;
        }

        if (this.config.openDevTools) {
            window.webContents.openDevTools();
        }
    }

    public async buildWindows(): Promise<void> {
        for (const windowConfig of this.config.windows) {
            await this.buildWindow(windowConfig);
        }
    }
}
