import {
    Transport,
    TransportEvent,
    TransportState,
} from '@web-auto/android-auto';
import { DataBuffer } from '@web-auto/android-auto';
import { Duplex } from 'node:stream';

export class ElectronDuplexTransport extends Transport {
    public static id = 0;

    public constructor(
        name: string,
        private socket: Duplex,
    ) {
        super(name);

        this.onData = this.onData.bind(this);
        this.onError = this.onError.bind(this);
        this.disconnect = this.disconnect.bind(this);
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
        this.socket.prependOnceListener('error', this.onError);
        this.socket.prependOnceListener('close', this.disconnect);
        this.state = TransportState.CONNECTED;
    }

    public async disconnect(): Promise<void> {
        if (this.state !== TransportState.CONNECTED) {
            return;
        }

        /*
         * Deinit can be called when the socket has been closed,
         * or it can be called to close the socket.
         * Either way, unregister all events and destroy the socket
         * if it is not destroyed already.
         */
        this.socket.off('close', this.disconnect);
        this.socket.off('error', this.onError);
        this.socket.off('data', this.onData);

        if (!this.socket.destroyed) {
            this.socket.destroy();
        }

        this.state = TransportState.DISCONNECTED;

        this.emitter.emit(TransportEvent.DISCONNECTED);
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
