import { Device } from 'usb';
import { LIBUSB_ENDPOINT_IN, LIBUSB_ENDPOINT_OUT, LIBUSB_REQUEST_TYPE_VENDOR, LibUSBException } from 'usb/dist/usb';

export enum StringType {
    MANUFACTURER,
    MODEL,
    DESCRIPTION,
    VERSION,
    URI,
    SERIAL,
}

const ACC_REQ_GET_PROTOCOL_VERSION = 51;
const ACC_REQ_SEND_STRING = 52;
const ACC_REQ_START = 53;

export async function controlTransfer(
    device: Device,
    bmRequestType: number,
    bRequest: number,
    wValue: number,
    wIndex: number,
    dataOrLength: number | Buffer,
): Promise<Buffer | number | undefined> {
    return new Promise((resolve, reject) => {
        device.controlTransfer(bmRequestType, bRequest, wValue, wIndex, dataOrLength,
            (error: LibUSBException | undefined, buffer: number | Buffer | undefined) => {
                if (error) {
                    return reject(error);
                }

                resolve(buffer);
            });
    });
}

export async function startProtocolQuery(device: Device): Promise<number> {
    const buffer = await controlTransfer(device,
        LIBUSB_ENDPOINT_IN | LIBUSB_REQUEST_TYPE_VENDOR,
        ACC_REQ_GET_PROTOCOL_VERSION, 0, 0, 2) as Buffer;
    return buffer.readUint16LE();
}

export async function startSendStringQuery(device: Device, stringType: StringType, str: string): Promise<void> {
    const data = Buffer.alloc(str.length + 1);
    data.write(str);
    await controlTransfer(device, LIBUSB_ENDPOINT_OUT | LIBUSB_REQUEST_TYPE_VENDOR,
        ACC_REQ_SEND_STRING, 0, stringType, data);
}

export async function startStartQuery(device: Device): Promise<void> {
    /* Library throws error if buffer is not passed when specifying out endpoint. */
    const data = Buffer.from('');
    await controlTransfer(device, LIBUSB_ENDPOINT_OUT | LIBUSB_REQUEST_TYPE_VENDOR,
        ACC_REQ_START, 0, 0, data);
}
