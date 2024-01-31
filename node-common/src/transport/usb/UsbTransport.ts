import { Transport, type TransportEvents } from '@web-auto/android-auto';
import type {
    UsbDeviceWrapper,
    UsbDeviceWrapperEndpointStartStopPollFunction,
    UsbDeviceWrapperEndpointTransferOutFunction,
} from './UsbDeviceWrapper.js';

export class UsbTransport extends Transport {
    private transferOut: UsbDeviceWrapperEndpointTransferOutFunction;
    private startPoll: UsbDeviceWrapperEndpointStartStopPollFunction;
    private stopPoll: UsbDeviceWrapperEndpointStartStopPollFunction;
    private onDataBound: (buffer: Uint8Array) => void;
    private onErrorBound: (error: Error) => void;

    public constructor(
        private device: UsbDeviceWrapper,
        events: TransportEvents,
    ) {
        super(events);

        [this.transferOut, this.startPoll, this.stopPoll] =
            this.device.getInterfaceTransferFunctions(0);

        this.onDataBound = this.onData.bind(this);
        this.onErrorBound = this.onError.bind(this);

        this.device.claimInterface(0);

        this.startPoll(this.onData.bind(this), this.onError.bind(this));
    }

    private onError(err: Error): void {
        this.device.close();
        this.events.onError(err);
        this.events.onDisconnected();
    }

    private onData(buffer: Uint8Array): void {
        this.events.onData(buffer);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async disconnect(): Promise<void> {
        this.stopPoll(this.onDataBound, this.onErrorBound);

        await this.device.releaseInterface(0);
    }

    public async send(buffer: Uint8Array): Promise<void> {
        return this.transferOut(buffer);
    }
}
