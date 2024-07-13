import { getLogger, setConfig } from '@web-auto/logging';
import { loadConfig } from '@web-auto/config-loader';
import { app } from 'electron';
import {
    ElectronWindowBuilder,
    type ElectronWindowBuilderConfig,
} from './ElectronWindowBuilder.js';
import { createAssert } from 'typia';
import {
    NodeAndroidAutoServer,
    NodeAndroidAutoServerBuilder,
    type NodeCommonAndroidAutoConfig,
} from '@web-auto/node-common';
import { GenericIpcServiceRegistry } from '@web-auto/common-ipc/main.js';
import { ElectronIpcServiceRegistrySocketHandler } from '@web-auto/electron-ipc/main.js';
import { DummyIpcSerializer } from '@web-auto/common-ipc';

type ElectronAndroidAutoConfig = {
    electronWindowBuilder: ElectronWindowBuilderConfig;
} & NodeCommonAndroidAutoConfig;

const configAssert = createAssert<ElectronAndroidAutoConfig>();

const config = loadConfig<ElectronAndroidAutoConfig>(configAssert);

setConfig(config.logging);

const logger = getLogger('electron');

logger.info('Electron config', config);

let androidAutoServer: NodeAndroidAutoServer | undefined;
let androidAutoIpcServiceRegistry: GenericIpcServiceRegistry | undefined;

if (config.androidAuto !== undefined) {
    androidAutoIpcServiceRegistry = new GenericIpcServiceRegistry([
        new ElectronIpcServiceRegistrySocketHandler(
            new DummyIpcSerializer(),
            config.registryName,
        ),
    ]);

    androidAutoIpcServiceRegistry.register();

    const builder = new NodeAndroidAutoServerBuilder(
        androidAutoIpcServiceRegistry,
        config.androidAuto,
    );

    androidAutoServer = builder.buildAndroidAutoServer();

    androidAutoServer.start().catch((err) => {
        logger.error('Failed to start android auto server', err);
    });
}

const electronWindowBuilder = new ElectronWindowBuilder(
    config.electronWindowBuilder,
);

app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar');
app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady()
    .then(async () => {
        electronWindowBuilder.logDisplays();

        try {
            await electronWindowBuilder.buildWindows();
        } catch (err) {
            logger.error('Failed to build windows', err);
        }
    })
    .catch((err) => {
        console.error(err);
    });

let cleanupRan = false;

const beforeQuit = async (event: {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
}) => {
    if (cleanupRan) {
        return;
    }

    event.preventDefault();

    if (androidAutoServer !== undefined) {
        await androidAutoServer.stop();
        androidAutoServer.destroy();
    }

    if (androidAutoIpcServiceRegistry !== undefined) {
        androidAutoIpcServiceRegistry.unregister();
    }

    cleanupRan = true;
    app.quit();
};

app.on('before-quit', (event) => {
    beforeQuit(event)
        .then(() => {})
        .catch((err) => {
            logger.error('Failed to stop', err);
        });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
