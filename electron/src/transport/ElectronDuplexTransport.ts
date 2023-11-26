import {
    Transport,
    TransportEvent,
    TransportState,
} from '@web-auto/android-auto';
import { DataBuffer } from '@web-auto/android-auto';
import { Duplex } from 'node:stream';

export class ElectronDuplexTransport extends Transport {
    public constructor(private socket: Duplex) {
        super();
        this.onData = this.onData.bind(this);
        this.onError = this.onError.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    private onData(data: Buffer): void {
        const buffer = DataBuffer.fromBuffer(data);
        this.emitter.emit(TransportEvent.DATA, buffer);
    }

    private onError(err: Error): void {
        this.emitter.emit(TransportEvent.ERROR, err);
    }

    public async connect(): Promise<void> {
        if (this.state !== TransportState.AVAILABLE) {
            return;
        }

        this.socket.on('data', this.onData);
        this.socket.on('error', this.onError);
        this.socket.once('close', this.onClose);

        this.state = TransportState.CONNECTED;
    }

    private onClose(): void {
        this.socket.off('error', this.onError);
        this.socket.off('data', this.onData);

        this.state = TransportState.DISCONNECTED;

        this.emitter.emit(TransportEvent.DISCONNECTED);
    }

    public async disconnect(): Promise<void> {
        if (this.state !== TransportState.CONNECTED) {
            return;
        }

        this.socket.off('error', this.onError);
        this.socket.off('data', this.onData);
        this.socket.off('close', this.onClose);

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
