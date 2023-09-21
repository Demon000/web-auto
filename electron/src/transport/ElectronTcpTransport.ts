import { Transport, TransportEvent } from '@web-auto/android-auto';
import { DataBuffer } from '@web-auto/android-auto';
import { Socket } from 'node:net';

export class ElectronTcpTransport extends Transport {
    public constructor(private socket: Socket) {
        super();

        this.onData = this.onData.bind(this);
    }

    private onData(data: Buffer): void {
        const buffer = DataBuffer.fromBuffer(data);
        this.emitter.emit(TransportEvent.DATA, buffer);
    }

    public init(): void {
        this.socket.on('data', this.onData);
    }

    public deinit(): void {
        this.socket.off('data', this.onData);
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
