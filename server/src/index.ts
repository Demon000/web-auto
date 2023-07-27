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
import { loadProtos } from './proto/proto';

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

    transport.onReceiveData((data) => {
        console.log(data);
    });

    usbDeviceMap.set(device, {
        device,
        transport,
        cryptor,
    });
}

async function deinitUsbDevice(device: Device): Promise<void> {
    const deviceData = usbDeviceMap.get(device);
    if (deviceData === undefined) {
        return;
    }

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
