import { ElectronWindowBuilderAndroidAuto } from './ElectronWindowBuilder';
import { ElectronAndroidAutoServiceFactory } from './services/ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer, DeviceHandler } from '@web-auto/android-auto';
import { ElectronUsbDeviceHandler } from './transport/ElectronUsbDeviceHandler';
import { ElectronTcpDeviceHandler } from './transport/ElectronTcpDeviceHandler';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/ElectronBluetoothDeviceHandler';
import { getLogger, setConfig } from '@web-auto/logging';
import { lilconfigSync } from 'lilconfig';
import JSON5 from 'json5';

const electronConfig = lilconfigSync('web-auto', {
    loaders: {
        '.json5': (_filepath, content) => {
            return JSON5.parse(content);
        },
    },
    searchPlaces: ['config.json5'],
}).search()?.config;

setConfig(electronConfig.logging);

const logger = getLogger('electron');

logger.info('Electron config', {
    metadata: electronConfig,
});

let androidAuto: ElectronWindowBuilderAndroidAuto | undefined;

if (electronConfig.androidAuto !== undefined) {
    const serviceFactory = new ElectronAndroidAutoServiceFactory(
        electronConfig.androidAuto.controlConfig,
        electronConfig.androidAuto.videoConfigs,
        electronConfig.androidAuto.touchScreenConfig,
    );

    const deviceHandlers: DeviceHandler[] = [
        new ElectronUsbDeviceHandler(
            electronConfig.androidAuto.usbDeviceHandlerConfig,
        ),
        new ElectronTcpDeviceHandler(
            electronConfig.androidAuto.tcpDeviceHandlerConfig,
        ),
    ];

    if (electronConfig.androidAuto.bluetoothDeviceHandlerConfig !== undefined) {
        deviceHandlers.push(
            new ElectronBluetoothDeviceHandler(
                electronConfig.androidAuto.bluetoothDeviceHandlerConfig,
            ),
        );
    }

    const server = new AndroidAutoServer(
        electronConfig.androidAuto.serverConfig,
        serviceFactory,
        deviceHandlers,
    );

    androidAuto = {
        server,
        serviceFactory,
    };
}

/*
import { ElectronAndroidAutoVideoServiceEvent } from './services/ElectronAndroidAutoVideoService';
import { DataBuffer } from '@web-auto/android-auto';

if (androidAuto !== undefined) {
    androidAuto.serviceFactory.emitter.on(
        ElectronAndroidAutoVideoServiceEvent.VIDEO_START,
        () => {
            console.log('video-start');
        },
    );

    androidAuto.serviceFactory.emitter.on(
        ElectronAndroidAutoVideoServiceEvent.VIDEO_STOP,
        () => {
            console.log('video-stop');
        },
    );

    androidAuto.serviceFactory.emitter.on(
        ElectronAndroidAutoVideoServiceEvent.VIDEO_DATA,
        (buffer: DataBuffer): void => {
            console.log('video-data', buffer);
        },
    );
    androidAuto.server.start();
}
*/

import { app, BrowserWindow } from 'electron';
import { ElectronWindowBuilder } from './ElectronWindowBuilder';

const electronWindowBuilder = new ElectronWindowBuilder(
    electronConfig.electronWindowBuilder,
    androidAuto,
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

    if (androidAuto !== undefined) {
        await androidAuto.server.stop();
    }

    cleanupRan = true;
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
