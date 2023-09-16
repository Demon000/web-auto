import { app, BrowserWindow } from 'electron';
import {
    ElectronWindowBuilder,
    ElectronWindowBuilderAndroidAuto,
} from './ElectronWindowBuilder';
import { autoConf } from 'auto-config-loader';
import { ElectronConfig } from './config';
import { ElectronAndroidAutoServiceFactory } from './services/ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer } from '@web-auto/android-auto';
import assert from 'node:assert';
import { ElectronUsbDeviceHandler } from './transport/ElectronUsbDeviceHandler';

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
