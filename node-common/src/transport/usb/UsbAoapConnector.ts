import { getLogger } from '@web-auto/logging';
import type { UsbDeviceWrapper } from './UsbDeviceWrapper.js';

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

    private async protocolQuery(device: UsbDeviceWrapper): Promise<number> {
        const ACC_REQ_GET_PROTOCOL_VERSION = 51;
        const result = await device.vendorControlTransferIn(
            ACC_REQ_GET_PROTOCOL_VERSION,
            0,
            0,
            2,
        );

        return result.readUint16LE();
    }

    private async sendString(
        device: UsbDeviceWrapper,
        stringType: StringType,
        str: string,
    ): Promise<void> {
        const ACC_REQ_SEND_STRING = 52;

        const data = Buffer.alloc(str.length + 1);
        data.write(str);

        await device.vendorControlTransferOut(
            ACC_REQ_SEND_STRING,
            0,
            stringType,
            data,
        );
    }

    private async start(device: UsbDeviceWrapper): Promise<void> {
        const ACC_REQ_START = 53;

        const data = Buffer.alloc(0);

        await device.vendorControlTransferOut(ACC_REQ_START, 0, 0, data);
    }

    private async checkUsbDeviceSupportsAoap(
        device: UsbDeviceWrapper,
    ): Promise<void> {
        const protocolVersion = await this.protocolQuery(device);
        if (protocolVersion !== 1 && protocolVersion !== 2) {
            throw new Error('Invalid AOAP protocol version');
        }
    }

    private async startAndroidAutoAoap(
        device: UsbDeviceWrapper,
    ): Promise<void> {
        await this.sendString(device, StringType.MANUFACTURER, 'Android');
        await this.sendString(device, StringType.MODEL, 'Android Auto');
        await this.sendString(device, StringType.DESCRIPTION, 'Android Auto');
        await this.sendString(device, StringType.VERSION, '2.0.1');

        await this.start(device);
    }

    public async connect(device: UsbDeviceWrapper): Promise<void> {
        this.logger.debug(`Found device ${device.name}`);

        try {
            await device.open();
        } catch (e) {
            this.logger.error(`Failed to open device ${device.name}`);
            return;
        }

        try {
            await this.checkUsbDeviceSupportsAoap(device);
        } catch (e) {
            this.logger.debug(`Found device ${device.name} without AOAP`, e);

            try {
                device.close();
            } catch (e) {
                this.logger.error(`Failed to close device ${device.name}`);
                return;
            }
            return;
        }

        this.logger.debug(`Found device ${device.name} with AOAP`);

        try {
            await this.startAndroidAutoAoap(device);
        } catch (e) {
            this.logger.error(`Failed to start AA on device ${device.name}`);

            try {
                device.close();
            } catch (e) {
                this.logger.error(`Failed to close device ${device.name}`);
                return;
            }
        }
    }
}
