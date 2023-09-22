import { ElectronWindowBuilderAndroidAuto } from './ElectronWindowBuilder';
import { autoConf } from 'auto-config-loader';
import { ElectronConfig } from './config';
import { ElectronAndroidAutoServiceFactory } from './services/ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer } from '@web-auto/android-auto';
import assert from 'node:assert';
import { ElectronUsbDeviceHandler } from './transport/ElectronUsbDeviceHandler';
import { ElectronTcpDeviceHandler } from './transport/ElectronTcpDeviceHandler';

const electronConfig = autoConf<ElectronConfig>('web-auto', {
    searchPlaces: ['../config.json5'],
    default: {
        electronWindowBuilder: {
            windows: [],
        },
    },
});

let androidAuto: ElectronWindowBuilderAndroidAuto | undefined;

if (electronConfig.androidAuto !== undefined) {
    const serviceFactory = new ElectronAndroidAutoServiceFactory(
        electronConfig.androidAuto.videoConfigs,
        electronConfig.androidAuto.touchScreenConfig,
    );
    const server = new AndroidAutoServer(serviceFactory, [
        new ElectronUsbDeviceHandler(),
        new ElectronTcpDeviceHandler(
            electronConfig.androidAuto.tcpDeviceHandlerConfig,
        ),
    ]);

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
