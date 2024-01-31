import {
    Transport,
    type TransportEvents,
    TransportState,
} from '@web-auto/android-auto';
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
    }

    private onError(err: Error): void {
        this.device.close();
        this.events.onError(err);
        this.events.onDisconnected();
    }

    private onData(buffer: Uint8Array): void {
        this.events.onData(buffer);
    }

    public async connect(): Promise<void> {
        if (this.state !== TransportState.AVAILABLE) {
            return;
        }

        await this.device.claimInterface(0);

        this.startPoll(this.onDataBound, this.onErrorBound);

        this.state = TransportState.CONNECTED;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async disconnect(): Promise<void> {
        if (this.state !== TransportState.CONNECTED) {
            return;
        }

        this.state = TransportState.DISCONNECTED;

        this.stopPoll(this.onDataBound, this.onErrorBound);

        await this.device.releaseInterface(0);
    }

    public async send(buffer: Uint8Array): Promise<void> {
        if (this.state === TransportState.DISCONNECTED) {
            throw new Error('Cannot send to disconnected tranport');
        }

        return this.transferOut(buffer);
    }
}
