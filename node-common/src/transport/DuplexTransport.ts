import {
    Transport,
    type TransportEvents,
    TransportState,
} from '@web-auto/android-auto';
import { Duplex } from 'node:stream';

export class DuplexTransport extends Transport {
    private onDataBound: (data: Uint8Array) => void;
    private onErrorBound: (err: Error) => void;
    private onCloseBound: () => void;

    public constructor(
        private socket: Duplex,
        events: TransportEvents,
    ) {
        super(events);

        this.onDataBound = this.onData.bind(this);
        this.onErrorBound = this.onError.bind(this);
        this.onCloseBound = this.onClose.bind(this);
    }

    private onData(data: Uint8Array): void {
        this.events.onData(data);
    }

    private onError(err: Error): void {
        this.events.onError(err);
    }

    private detachEvents(): void {
        this.socket.off('error', this.onErrorBound);
        this.socket.off('data', this.onDataBound);
        this.socket.off('close', this.onCloseBound);
    }

    private attachEvents(): void {
        this.socket.on('data', this.onDataBound);
        this.socket.on('error', this.onErrorBound);
        this.socket.on('close', this.onCloseBound);
    }

    private onClose(): void {
        this.detachEvents();

        this.state = TransportState.DISCONNECTED;

        this.events.onDisconnected();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async connect(): Promise<void> {
        if (this.state !== TransportState.AVAILABLE) {
            return;
        }

        this.attachEvents();

        this.state = TransportState.CONNECTED;
    }

    public async disconnect(): Promise<void> {
        if (this.state !== TransportState.CONNECTED) {
            return;
        }

        this.detachEvents();

        this.state = TransportState.DISCONNECTED;

        return new Promise((resolve, _reject) => {
            this.socket.once('close', resolve);
            this.socket.destroy();
        });
    }

    public async send(buffer: Uint8Array): Promise<void> {
        if (this.state === TransportState.DISCONNECTED) {
            throw new Error('Cannot send to disconnected tranport');
        }

        return new Promise((resolve, reject) => {
            this.socket.write(buffer, (err) => {
                if (err !== undefined && err !== null) {
                    return reject(err);
                }

                resolve();
            });
        });
    }
}
