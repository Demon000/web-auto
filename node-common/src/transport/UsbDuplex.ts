import assert from 'node:assert';
import { Duplex } from 'node:stream';

export class UsbDuplex extends Duplex {
    private inEndpoint: USBEndpoint;
    private outEndpoint: USBEndpoint;
    private interfaceClaimed = false;

    public constructor(private device: USBDevice) {
        super();

        assert(device.configuration !== undefined);

        const intf = device.configuration.interfaces[0];
        assert(intf !== undefined);

        let inEndpoint: USBEndpoint | undefined;
        let outEndpoint: USBEndpoint | undefined;

        const endpoints = intf.alternate.endpoints;
        for (const endpoint of endpoints) {
            if (endpoint.direction == 'in') {
                inEndpoint = endpoint;
            }

            if (endpoint.direction == 'out') {
                outEndpoint = endpoint;
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
    }

    public override _destroy(
        _err: Error | null,
        callback: (err: Error | null) => void,
    ): void {
        this.destroyAsync()
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                callback(err);
            });
    }

    private async writeAsync(buffer: Uint8Array): Promise<void> {
        const result = await this.device.transferOut(
            this.outEndpoint.endpointNumber,
            buffer,
        );

        if (result.status !== 'ok') {
            throw new Error('Invalid status');
        }
    }

    public override _write(
        chunk: any,
        _encoding: string,
        callback: (err: Error | null) => void,
    ): void {
        if (!(chunk instanceof Buffer)) {
            callback(new Error('Chunk is not a buffer'));
            return;
        }

        let callbackCalled = false;
        const timeout = setTimeout(() => {
            callbackCalled = true;
            callback(new Error('Transfer timed out'));
        }, 5000);

        this.writeAsync(chunk)
            .then(() => {
                clearTimeout(timeout);
                if (callbackCalled) return;
                callback(null);
            })
            .catch((err) => {
                clearTimeout(timeout);
                if (callbackCalled) return;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                callback(err);
            });
    }

    private async readAsync(): Promise<void> {
        let result;
        try {
            result = await this.device.transferIn(
                this.inEndpoint.endpointNumber,
                this.inEndpoint.packetSize,
            );
        } catch (e: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
            void this.readAsync();
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

    public override _read() {
        void this.readAsync();
    }
}
