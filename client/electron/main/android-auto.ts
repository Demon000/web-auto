import { AndroidAutoServer, DataBuffer } from '@web-auto/android-auto';
import { ElectronServiceFactory } from './ElectronServiceFactory';
import { BrowserWindow } from 'electron';
import { MainCommuncationChannel } from './ipc';
import {
    ANDROID_AUTO_CHANNEL_NAME,
    AndroidAutoMainMethod,
    AndroidAutoMainMethods,
    AndroidAutoRendererMethod,
    AndroidAutoRendererMethods,
} from '@shared/ipc';
import { ElectronVideoServiceEvent } from './ElectronVideoService';

export class AndroidAutoCommuncationChannel extends MainCommuncationChannel<
    AndroidAutoMainMethods,
    AndroidAutoRendererMethods
> {
    public constructor(window: BrowserWindow) {
        super(ANDROID_AUTO_CHANNEL_NAME, window);
    }
}

export function createAndroidAutoServer(window: BrowserWindow): void {
    const channel = new AndroidAutoCommuncationChannel(window);

    const serviceFactory = new ElectronServiceFactory();
    const androidAutoServer = new AndroidAutoServer(serviceFactory);

    channel.on(AndroidAutoMainMethod.START, () => {
        androidAutoServer.start();
    });

    serviceFactory.emitter.on(
        ElectronVideoServiceEvent.DATA,
        (buffer: DataBuffer) => {
            channel.send(AndroidAutoRendererMethod.VIDEO_DATA, buffer.data);
        },
    );

    process.on('SIGINT', () => {
        androidAutoServer.stop();
        process.exit();
    });
}
