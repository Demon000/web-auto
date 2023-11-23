import { ElectronWindowBuilderAndroidAuto } from './ElectronWindowBuilder';
import { autoConf } from 'auto-config-loader';
import { ElectronConfig } from './config';
import { ElectronAndroidAutoServiceFactory } from './services/ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer, DeviceHandler } from '@web-auto/android-auto';
import assert from 'node:assert';
import { ElectronUsbDeviceHandler } from './transport/ElectronUsbDeviceHandler';
import { ElectronTcpDeviceHandler } from './transport/ElectronTcpDeviceHandler';
import { ElectronBluetoothDeviceHandler } from './transport/bluetooth/ElectronBluetoothDeviceHandler';
import { getLogger, setConfig } from '@web-auto/logging';

const electronConfig = autoConf<ElectronConfig>('web-auto', {
    searchPlaces: ['../config.json5'],
    default: {
        logging: {
            debug: true,
        },
        electronWindowBuilder: {
            windows: [],
        },
    },
});

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
        new ElectronUsbDeviceHandler(),
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

    process.on('exit', () => {
        assert(server);
        server.stop();
    });
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

app.whenReady().then(() => {
    electronWindowBuilder.logDisplays();

    electronWindowBuilder.buildWindows();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            electronWindowBuilder.buildWindows();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
