import {
    Transport,
    type TransportEvents,
    TransportState,
} from '@web-auto/android-auto';
import { Duplex } from 'node:stream';

export class DuplexTransport extends Transport {
    public constructor(
        private socket: Duplex,
        events: TransportEvents,
    ) {
        super(events);

        this.onData = this.onData.bind(this);
        this.onError = this.onError.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    private onData(data: Buffer): void {
        const buffer = DataBuffer.fromBuffer(data);
        this.events.onData(buffer);
    }

    private onError(err: Error): void {
        this.events.onError(err);
    }

    private detachEvents(): void {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.off('error', this.onError);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.off('data', this.onData);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.off('close', this.onClose);
    }

    private attachEvents(): void {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.on('data', this.onData);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.on('error', this.onError);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.on('close', this.onClose);
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

    public async send(buffer: DataBuffer): Promise<void> {
        if (this.state === TransportState.DISCONNECTED) {
            throw new Error('Cannot send to disconnected tranport');
        }

        return new Promise((resolve, reject) => {
            this.socket.write(buffer.data, (err) => {
                if (err !== undefined && err !== null) {
                    return reject(err);
                }

                resolve();
            });
        });
    }
}
