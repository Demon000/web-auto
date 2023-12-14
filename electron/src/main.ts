import { getLogger, setConfig } from '@web-auto/logging';
import { lilconfigSync } from 'lilconfig';
import JSON5 from 'json5';

import { app, BrowserWindow } from 'electron';
import {
    ElectronWindowBuilder,
    type ElectronWindowBuilderConfig,
} from './ElectronWindowBuilder.js';
import { assert } from 'typia';
import {
    NodeAndroidAutoServer,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { ElectronIpcServiceRegistry } from '@web-auto/electron-ipc/main.js';
import { ANDROID_AUTO_IPC_REGISTRY_NAME } from '@web-auto/android-auto-ipc';

type ElectronAndroidAutoConfig = {
    electronWindowBuilder: ElectronWindowBuilderConfig;
} & NodeCommonAndroidAutoConfig;

const config = lilconfigSync('web-auto', {
    loaders: {
        '.json5': (_filepath, content) => {
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config as ElectronAndroidAutoConfig;

assert<ElectronAndroidAutoConfig>(config);

setConfig(config.logging);

const logger = getLogger('electron');

logger.info('Electron config', config);

let androidAutoServer: NodeAndroidAutoServer | undefined;
let androidAutoIpcServiceRegistry: ElectronIpcServiceRegistry | undefined;

if (config.androidAuto !== undefined) {
    androidAutoIpcServiceRegistry = new ElectronIpcServiceRegistry(
        ANDROID_AUTO_IPC_REGISTRY_NAME,
    );

    androidAutoIpcServiceRegistry.register();

    androidAutoServer = new NodeAndroidAutoServer(
        androidAutoIpcServiceRegistry,
        config.androidAuto,
    );

    androidAutoServer.build();

    androidAutoServer.start().catch((err) => {
        logger.error('Failed to start android auto server', err);
    });
}

const electronWindowBuilder = new ElectronWindowBuilder(
    config.electronWindowBuilder,
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
