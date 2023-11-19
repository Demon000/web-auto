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

    public connect(): void {
        if (this.state !== TransportState.AVAILABLE) {
            return;
        }

        this.socket.on('data', this.onData);
        this.socket.prependOnceListener('error', this.onError);
        this.socket.prependOnceListener('close', this.onClose);

        this.state = TransportState.CONNECTED;
    }

    private onClose(): void {
        this.socket.off('error', this.onError);
        this.socket.off('data', this.onData);

        this.state = TransportState.DISCONNECTED;

        this.emitter.emit(TransportEvent.DISCONNECTED);
    }

    public disconnect(): void {
        if (this.state !== TransportState.CONNECTED) {
            return;
        }

        this.socket.destroy();
    }

    public async send(buffer: DataBuffer): Promise<void> {
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
