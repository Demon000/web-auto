import { Device, type DeviceEvents } from '@web-auto/android-auto';
import { DuplexTransport } from '../DuplexTransport.js';
import { Socket } from 'node:net';
import { TCP_SERVER_PORT } from './tcp.js';

export class TcpDevice extends Device {
    private transport: DuplexTransport | undefined;

    public constructor(
        private ip: string,
        events: DeviceEvents,
    ) {
        super('TCP', ip, events);
    }

    public async connectImpl(): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new Socket();

            const onSocketError = (err: Error) => {
                reject(err);
            };

            socket.once('error', onSocketError);

            socket.once('connect', () => {
                /*
                 * Error handling is handed off to the transport, remove
                 * the handler here.
                 */
                socket.off('error', onSocketError);

                this.transport = new DuplexTransport(socket, {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    onData: this.onDataBound,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    onDisconnected: this.onDisconnectedBound,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    onError: this.onErrorBound,
                });

                resolve();
            });

            socket.connect(TCP_SERVER_PORT, this.ip);
        });
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected override async disconnectImpl(
        _reason: string | undefined,
    ): Promise<void> {
        if (this.transport !== undefined) {
            this.transport.disconnect();
            this.transport = undefined;
        }
    }

    public override send(buffer: Uint8Array): void {
        if (this.transport === undefined) {
            this.logger.error('Device has no transport');
            return;
        }

        this.transport.send(buffer);
    }
}
