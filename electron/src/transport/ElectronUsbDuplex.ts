import assert from 'node:assert';
import { Duplex } from 'node:stream';

export class ElectronUsbDuplex extends Duplex {
    private inEndpoint: USBEndpoint;
    private outEndpoint: USBEndpoint;
    private interfaceClaimed = false;

    public constructor(private device: USBDevice) {
        super();

        assert(device.configuration !== undefined);

        let inEndpoint: USBEndpoint | undefined;
        let outEndpoint: USBEndpoint | undefined;
        const endpoints =
            device.configuration.interfaces[0].alternate.endpoints;
        for (const endpoint of endpoints) {
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

    public async claimInterface(): Promise<void> {
        if (this.interfaceClaimed) {
            return;
        }
        await this.device.claimInterface(0);
        this.interfaceClaimed = true;
    }

    public async destroyAsync(): Promise<void> {
        if (!this.device.opened) return;

        if (this.interfaceClaimed) {
            await this.device.releaseInterface(0);
        }
        await this.device.close();
    }

    public _destroy(
        err: Error | null,
        callback: (err: Error | null) => void,
    ): void {
        this.destroyAsync()
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                callback(err);
            });
    }

    private async writeAsync(buffer: Buffer): Promise<void> {
        await this.claimInterface();

        const result = await this.device.transferOut(
            this.outEndpoint.endpointNumber,
            buffer,
        );

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    public _write(
        chunk: any,
        _encoding: string,
        callback: (err: Error | null) => void,
    ): void {
        if (!(chunk instanceof Buffer)) {
            this.destroy(new Error('Chunk is not a buffer'));
            return;
        }

        this.writeAsync(chunk)
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                callback(err);
            });
    }

    private async readAsync(): Promise<void> {
        await this.claimInterface();

        let result;
        try {
            result = await this.device.transferIn(
                this.inEndpoint.endpointNumber,
                this.inEndpoint.packetSize,
            );
        } catch (e: any) {
            this.destroy(e);
            return;
        }

        if (result.status !== 'ok') {
            this.destroy(new Error('Invalid status'));
            return;
        }

        if (result.data === undefined) {
            this.destroy(new Error('Data is undefined'));
            return;
        }

        if (result.data.byteLength === 0) {
            this.readAsync();
            return;
        }

        this.push(
            Buffer.from(
                result.data.buffer,
                result.data.byteOffset,
                result.data.byteLength,
            ),
        );
    }

    public _read() {
        this.readAsync();
    }
}
