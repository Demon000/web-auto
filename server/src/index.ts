import { Device } from 'usb';
import { enumerateDevices } from './usb/enumerate';
import {
    StringType,
    startProtocolQuery,
    startSendStringQuery,
    startStartQuery,
} from './usb/query';
import { UsbTransport } from './transport/USBTransport';
import { Cryptor } from './ssl/Cryptor';
import fs from 'fs';
import path from 'path';
import { getStringDescriptor } from './usb/descriptors';
import { MessageInStream } from './messenger/MessageInStream';
import { MessageOutStream } from './messenger/MessageOutStream';
import { loadProtos } from './proto/proto';
import { ControlService } from './services/ControlService';
import { DataBuffer } from './utils/DataBuffer';

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

type DeviceData = {
    device: Device;
    transport: UsbTransport;
    cryptor: Cryptor;
};

const usbDeviceMap = new Map<Device, DeviceData>();

async function initUsbDevice(device: Device): Promise<void> {
    const protocolVersion = await startProtocolQuery(device);
    if (protocolVersion !== 1 && protocolVersion !== 2) {
        return;
    }

    const deviceDescriptor = device.deviceDescriptor;
    const manufacturer = await getStringDescriptor(
        device,
        deviceDescriptor.iManufacturer,
    );
    const deviceName = await getStringDescriptor(
        device,
        deviceDescriptor.iProduct,
    );

    console.log(`Connected to device ${manufacturer} ${deviceName}`);
    console.log(`Protocol version: ${protocolVersion}`);

    await startSendStringQuery(device, StringType.MANUFACTURER, 'Android');
    await startSendStringQuery(device, StringType.MODEL, 'Android Auto');
    await startSendStringQuery(device, StringType.DESCRIPTION, 'Android Auto');
    await startSendStringQuery(device, StringType.VERSION, '2.0.1');
    // await startSendStringQuery(device, StringType.URI, "https://f1xstudio.com");
    // await startSendStringQuery(device, StringType.SERIAL, "HU-AAAAAA001");
    await startStartQuery(device);

    const transport = new UsbTransport(device);
    const cryptor = new Cryptor(certificateString, privateKeyString);
    cryptor.init();

    const messageInStream = new MessageInStream(cryptor);
    const messageOutStream = new MessageOutStream(transport, cryptor);

    const controlService = new ControlService(
        cryptor,
        messageInStream,
        messageOutStream,
    );

    transport.startReceivePoll();
    transport.onReceiveData((data) => {
        const buffer = DataBuffer.fromBuffer(data);
        messageInStream.parseBuffer(buffer);
    });

    usbDeviceMap.set(device, {
        device,
        transport,
        cryptor,
    });

    await controlService.start();
}

async function deinitUsbDevice(device: Device): Promise<void> {
    const deviceData = usbDeviceMap.get(device);
    if (deviceData === undefined) {
        return;
    }

    deviceData.transport.stopReceivePoll();
    deviceData.cryptor.deinit();
    deviceData.device.close();
}

async function waitForUsbDevices(): Promise<void> {
    const devices = enumerateDevices();
    for (const device of devices) {
        device.open();
        try {
            await initUsbDevice(device);
            break;
        } catch (e) {
            console.log(e);
            device.close();
        }
    }
}

async function init(): Promise<void> {
    await loadProtos();
    waitForUsbDevices();
}

process.on('SIGINT', () => {
    for (const device of usbDeviceMap.keys()) {
        deinitUsbDevice(device);
    }

    process.exit();
});

init();
