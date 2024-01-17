import { Duplex } from 'node:stream';
import type {
    UsbDeviceWrapper,
    UsbDeviceWrapperEndpointStartStopPollFunction,
    UsbDeviceWrapperEndpointTransferOutFunction,
} from './UsbDeviceWrapper.js';

export class UsbDuplex extends Duplex {
    private transferOut: UsbDeviceWrapperEndpointTransferOutFunction;
    private startPoll: UsbDeviceWrapperEndpointStartStopPollFunction;
    private stopPoll: UsbDeviceWrapperEndpointStartStopPollFunction;
    private onPollDataBound: (buffer: Uint8Array) => void;
    private onPollErrorBound: (error: Error) => void;
    private interfaceClaimed = false;

    public constructor(private device: UsbDeviceWrapper) {
        super();

        [this.transferOut, this.startPoll, this.stopPoll] =
            this.device.getInterfaceTransferFunctions(0);

        this.onPollDataBound = this.onPollData.bind(this);
        this.onPollErrorBound = this.onPollError.bind(this);
    }

    public async claimInterface(): Promise<void> {
        if (this.interfaceClaimed) {
            return;
        }
        await this.device.claimInterface(0);
        this.interfaceClaimed = true;
    }

    public async destroyAsync(stopPoll: boolean): Promise<void> {
        if (!this.device.opened) return;

        if (stopPoll) {
            this.stopPoll(this.onPollDataBound, this.onPollErrorBound);
        }

        if (this.interfaceClaimed) {
            await this.device.releaseInterface(0);
        }
    }

    public override _destroy(
        err: Error | null,
        callback: (err: Error | null) => void,
    ): void {
        this.destroyAsync(err === null)
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                callback(err);
            });
    }

    public override _write(
        chunk: any,
        _encoding: string,
        callback: (err: Error | null) => void,
    ): void {
        if (!(chunk instanceof Uint8Array)) {
            callback(new Error('Chunk is not a buffer'));
            return;
        }

        this.transferOut(chunk)
            .then(() => {
                callback(null);
            })
            .catch((err) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                callback(err);
            });
    }

    private onPollError(err: Error): void {
        this.destroy(err);
    }

    private onPollData(buffer: Uint8Array): void {
        this.push(buffer);
    }

    public override _read() {
        this.startPoll(this.onPollDataBound, this.onPollErrorBound);
    }
}
