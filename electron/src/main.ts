import { getLogger, setConfig } from '@web-auto/logging';
import { lilconfigSync } from 'lilconfig';
import JSON5 from 'json5';

import { app, BrowserWindow } from 'electron';
import { ElectronWindowBuilder } from './ElectronWindowBuilder.js';
import { assert } from 'typia';
import { type ElectronConfig } from './config.js';
import { ElectronAndroidAutoServer } from './ElectronAndroidAutoServer.js';
import { ElectronIpcServiceRegistry } from '@web-auto/electron-ipc/main.js';
import { ANDROID_AUTO_IPC_REGISTRY_NAME } from '@web-auto/android-auto-ipc';

const electronConfig = lilconfigSync('web-auto', {
    loaders: {
        '.json5': (_filepath, content) => {
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config as ElectronConfig;

assert<ElectronConfig>(electronConfig);

setConfig(electronConfig.logging);

const logger = getLogger('electron');

logger.info('Electron config', {
    metadata: electronConfig,
});

let androidAutoServer: ElectronAndroidAutoServer | undefined;
let androidAutoIpcServiceRegistry: ElectronIpcServiceRegistry | undefined;

if (electronConfig.androidAuto !== undefined) {
    androidAutoIpcServiceRegistry = new ElectronIpcServiceRegistry(
        ANDROID_AUTO_IPC_REGISTRY_NAME,
    );

    androidAutoIpcServiceRegistry.register();

    androidAutoServer = new ElectronAndroidAutoServer(
        androidAutoIpcServiceRegistry,
        electronConfig.androidAuto,
    );

    androidAutoServer.build();

    androidAutoServer.start().catch((err) => {
        logger.error('Failed to start android auto server', {
            metadata: err,
        });
    });
}

const electronWindowBuilder = new ElectronWindowBuilder(
    electronConfig.electronWindowBuilder,
    androidAutoIpcServiceRegistry,
);

app.whenReady()
    .then(() => {
        electronWindowBuilder.logDisplays();

        electronWindowBuilder.buildWindows();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) {
                electronWindowBuilder.buildWindows();
            }
        });
    })
    .catch((err) => {
        console.error(err);
    });

let cleanupRan = false;
app.on('before-quit', async (event) => {
    if (cleanupRan) {
        return;
    }

    event.preventDefault();

    if (androidAutoServer !== undefined) {
        await androidAutoServer.stop();
    }

    if (androidAutoIpcServiceRegistry !== undefined) {
        androidAutoIpcServiceRegistry.unregister();
    }

    cleanupRan = true;
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
