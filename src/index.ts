import { UsbTransport } from './usb/USBTransport';
import { Cryptor } from './ssl/Cryptor';
import fs from 'fs';
import path from 'path';
import { MessageInStream } from './messenger/MessageInStream';
import { MessageOutStream } from './messenger/MessageOutStream';
import { ControlService } from './services/ControlService';
import { ITransport, TransportEvent } from './transport/ITransport';
import {
    UsbDeviceHandler,
    UsbDeviceHandlerEvent,
} from './usb/UsbDeviceHandler';
import { Device } from 'usb';
import {
    DummyVideoService,
    DummyVideoServiceEvent,
} from './services/DummyVideoService';
import { AudioService } from './services/AudioService';
import { ChannelId } from './messenger/ChannelId';
import { AudioInputService } from './services/AudioInputService';
import { DummyInputService } from './services/DummyInputService';
import { SensorService } from './services/SensorService';
import { MediaStatusService } from './services/MediaStatusService';
import { NavigationStatusService } from './services/NavigationStatusService';

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

type DeviceCookie = any;

type DeviceData = {
    device: DeviceCookie;
    transport: ITransport;
    cryptor: Cryptor;
};

const deviceMap = new Map<Device, DeviceData>();

async function initDevice(
    device: DeviceCookie,
    transport: ITransport,
): Promise<void> {
    const cryptor = new Cryptor(certificateString, privateKeyString);

    cryptor.init();

    deviceMap.set(device, {
        device,
        transport,
        cryptor,
    });

    const messageInStream = new MessageInStream(transport, cryptor);
    const messageOutStream = new MessageOutStream(transport, cryptor);

    const videoService = new DummyVideoService(
        messageInStream,
        messageOutStream,
    );

    const services = [
        new AudioInputService(messageInStream, messageOutStream),
        new AudioService(
            ChannelId.MEDIA_AUDIO,
            messageInStream,
            messageOutStream,
        ),
        new AudioService(
            ChannelId.SPEECH_AUDIO,
            messageInStream,
            messageOutStream,
        ),
        new AudioService(
            ChannelId.SYSTEM_AUDIO,
            messageInStream,
            messageOutStream,
        ),
        new SensorService(messageInStream, messageOutStream),
        videoService,
        new NavigationStatusService(messageInStream, messageOutStream),
        new MediaStatusService(messageInStream, messageOutStream),
        new DummyInputService(messageInStream, messageOutStream),
    ];

    videoService.emitter.on(DummyVideoServiceEvent.DATA, (buffer) => {
        wss.clients.forEach((socket) => {
            socket.send(buffer.data);
        });
    });

    const controlService = new ControlService(
        cryptor,
        services,
        messageInStream,
        messageOutStream,
    );

    transport.emitter.on(TransportEvent.DATA, (buffer) => {
        if (!buffer.size) {
            console.trace('Received zero-sized buffer');
            return;
        }

        messageInStream.parseBuffer(buffer);
    });
    transport.emitter.on(TransportEvent.ERROR, (err) => {
        console.log(err);
    });
    transport.init();

    await controlService.start();
}

function deinitDevice(device: DeviceCookie): void {
    const deviceData = deviceMap.get(device);
    if (deviceData === undefined) {
        return;
    }

    deviceData.transport.deinit();
    deviceData.cryptor.deinit();
}

async function init(): Promise<void> {
    const usbDeviceHandler = new UsbDeviceHandler();

    usbDeviceHandler.emitter.on(
        UsbDeviceHandlerEvent.CONNECTED,
        async (device: Device) => {
            const transport = new UsbTransport(device);

            await initDevice(device, transport);
        },
    );

    usbDeviceHandler.emitter.on(
        UsbDeviceHandlerEvent.DISCONNECTED,
        (device: Device) => {
            deinitDevice(device);
        },
    );

    const handleEnd = () => {
        usbDeviceHandler.stopWaitingForDevices();
        usbDeviceHandler.disconnectDevices();
        process.exit();
    };

    process.on('SIGINT', handleEnd);

    await usbDeviceHandler.waitForDevices();
}

init();
