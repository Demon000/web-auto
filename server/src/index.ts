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

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

async function startQueries(device: Device): Promise<void> {
    const protocolVersion = await startProtocolQuery(device);
    if (protocolVersion !== 1 && protocolVersion !== 2) {
        return;
    }

    console.log(device);
    console.log(`Protocol version: ${protocolVersion}`);

    await startSendStringQuery(device, StringType.MANUFACTURER, 'Android');
    await startSendStringQuery(device, StringType.MODEL, 'Android Auto');
    await startSendStringQuery(device, StringType.DESCRIPTION, 'Android Auto');
    await startSendStringQuery(device, StringType.VERSION, '2.0.1');
    // await startSendStringQuery(device, StringType.URI, "https://f1xstudio.com");
    // await startSendStringQuery(device, StringType.SERIAL, "HU-AAAAAA001");
    await startStartQuery(device);

    const usbTransport = new UsbTransport(device);
    const cryptor = new Cryptor(certificateString, privateKeyString);
    cryptor.init();
    cryptor.deinit();
}

(async () => {
    const devices = enumerateDevices();
    for (const device of devices) {
        device.open();
        try {
            await startQueries(device);
            console.log('Connected successfully');
            break;
        } catch (e) {
            console.log(e);
        }

        device.close();
    }
})();
