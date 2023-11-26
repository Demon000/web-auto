import { getLogger } from '@web-auto/logging';
import { usbDeviceName as name } from './UsbDevice';

enum StringType {
    MANUFACTURER,
    MODEL,
    DESCRIPTION,
    VERSION,
    URI,
    SERIAL,
}

export class UsbAoapConnector {
    private logger = getLogger(this.constructor.name);

    private async protocolQuery(device: USBDevice): Promise<number> {
        const ACC_REQ_GET_PROTOCOL_VERSION = 51;
        const result = await device.controlTransferIn(
            {
                requestType: 'vendor',
                recipient: 'device',
                request: ACC_REQ_GET_PROTOCOL_VERSION,
                value: 0,
                index: 0,
            },
            2,
        );

        if (result.data === undefined) {
            throw new Error('Invalid data');
        } else if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }

        return result.data.getUint16(0, true);
    }

    private async sendString(
        device: USBDevice,
        stringType: StringType,
        str: string,
    ): Promise<void> {
        const ACC_REQ_SEND_STRING = 52;

        const data = Buffer.alloc(str.length + 1);
        data.write(str);

        const result = await device.controlTransferOut(
            {
                requestType: 'vendor',
                recipient: 'device',
                request: ACC_REQ_SEND_STRING,
                value: 0,
                index: stringType,
            },
            data,
        );

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    private async start(device: USBDevice): Promise<void> {
        const ACC_REQ_START = 53;

        const result = await device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: ACC_REQ_START,
            value: 0,
            index: 0,
        });

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    private async checkUsbDeviceSupportsAoap(device: USBDevice): Promise<void> {
        const protocolVersion = await this.protocolQuery(device);
        if (protocolVersion !== 1 && protocolVersion !== 2) {
            throw new Error('Invalid AOAP protocol version');
        }
    }

    private async startAndroidAutoAoap(device: USBDevice): Promise<void> {
        await this.sendString(device, StringType.MANUFACTURER, 'Android');
        await this.sendString(device, StringType.MODEL, 'Android Auto');
        await this.sendString(device, StringType.DESCRIPTION, 'Android Auto');
        await this.sendString(device, StringType.VERSION, '2.0.1');

        await this.start(device);
    }

    public async connect(device: USBDevice): Promise<void> {
        this.logger.debug(`Found device ${name(device)}`);

        try {
            await device.open();
        } catch (e) {
            this.logger.error(`Failed to open device ${name(device)}`);
            return;
        }

        try {
            await this.checkUsbDeviceSupportsAoap(device);
        } catch (e) {
            this.logger.debug(`Found device ${name(device)} without AOAP`);

            try {
                await device.close();
            } catch (e) {
                this.logger.error(`Failed to close device ${name(device)}`);
                return;
            }
            return;
        }

        this.logger.debug(`Found device ${name(device)} with AOAP`);

        try {
            await this.startAndroidAutoAoap(device);
        } catch (e) {
            this.logger.error(`Failed to start AA on device ${name(device)}`);

            try {
                await device.close();
            } catch (e) {
                this.logger.error(`Failed to close device ${name(device)}`);
                return;
            }
        }
    }
}
