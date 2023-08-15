import { app, BrowserWindow } from 'electron';
import { ElectronWindowBuilder } from './ElectronWindowBuilder';
import { autoConf } from 'auto-config-loader';
import { ElectronConfig } from './config';
import { ElectronAndroidAutoServiceFactory } from './ElectronAndroidAutoServiceFactory';
import { AndroidAutoServer } from '@web-auto/android-auto';
import assert from 'node:assert';

const electronConfig = autoConf<ElectronConfig>('web-auto', {
    searchPlaces: ['../config.json5'],
    default: {
        electronWindowBuilder: {
            windows: [],
        },
    },
});

let serviceFactory: ElectronAndroidAutoServiceFactory | undefined;
let androidAutoServer: AndroidAutoServer | undefined;
if (
    electronConfig.createAndroidAutoServer !== undefined &&
    electronConfig.createAndroidAutoServer
) {
    serviceFactory = new ElectronAndroidAutoServiceFactory();
    androidAutoServer = new AndroidAutoServer(serviceFactory);

    process.on('exit', () => {
        assert(androidAutoServer);
        androidAutoServer.stop();
    });
}

const electronWindowBuilder = new ElectronWindowBuilder(
    electronConfig.electronWindowBuilder,
    serviceFactory,
    androidAutoServer,
);

app.whenReady().then(() => {
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
