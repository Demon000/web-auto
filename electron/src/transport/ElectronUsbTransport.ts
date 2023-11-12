import { Transport, TransportEvent } from '@web-auto/android-auto';
import { DataBuffer } from '@web-auto/android-auto';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';

export class ElectronUsbTransport extends Transport {
    private logger = getLogger(this.constructor.name);

    private inEndpoint: USBEndpoint;
    private outEndpoint: USBEndpoint;

    public constructor(private device: USBDevice) {
        super();

        assert(device.configuration !== undefined);

        let inEndpoint: USBEndpoint | undefined;
        let outEndpoint: USBEndpoint | undefined;
        for (const endpoint of device.configuration.interfaces[0].alternate
            .endpoints) {
            if (endpoint.direction == 'in') {
                inEndpoint = endpoint as USBEndpoint;
            }

            if (endpoint.direction == 'out') {
                outEndpoint = endpoint as USBEndpoint;
            }

            if (inEndpoint && outEndpoint) {
                break;
            }
        }

        if (!inEndpoint || !outEndpoint) {
            throw new Error('Failed to find endpoints');
        }

        this.inEndpoint = inEndpoint;
        this.outEndpoint = outEndpoint;
    }

    private async read(): Promise<void> {
        let result;
        try {
            result = await this.device.transferIn(
                this.inEndpoint.endpointNumber,
                this.inEndpoint.packetSize,
            );
        } catch (e) {
            return;
        }

        if (result.status !== 'ok' || result.data === undefined) {
            throw new Error('Invalid status');
        }

        if (result.data.byteLength) {
            const buffer = DataBuffer.fromDataView(result.data);
            this.emitter.emit(TransportEvent.DATA, buffer);
        }

        this.read();
    }

    public async init(): Promise<void> {
        await this.device.claimInterface(0);

        this.read();
    }

    public async deinit(): Promise<void> {
        if (!this.device.opened) return;

        try {
            await this.device.releaseInterface(0);
            await this.device.close();
        } catch (e) {
            this.logger.error(e);
        }
    }

    public async send(buffer: DataBuffer): Promise<void> {
        const result = await this.device.transferOut(
            this.outEndpoint.endpointNumber,
            buffer.data,
        );
        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }
}
