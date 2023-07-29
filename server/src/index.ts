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

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

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

    const messageInStream = new MessageInStream(cryptor);
    const messageOutStream = new MessageOutStream(transport, cryptor);

    const controlService = new ControlService(
        cryptor,
        messageInStream,
        messageOutStream,
    );

    transport.emitter.on(TransportEvent.DATA, (buffer) => {
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
        async (device: Device) => {
            deinitDevice(device);
        },
    );

    const handleEnd = async () => {
        usbDeviceHandler.stopWaitingForDevices();
        await usbDeviceHandler.disconnectDevices();
        process.exit();
    };

    process.on('SIGINT', () => handleEnd);

    await usbDeviceHandler.waitForDevices();
}

init();
