import { Socket } from 'node:net';

import {
    Device,
    DeviceConnectReason,
    type DeviceEvents,
} from '@web-auto/android-auto';

import { DuplexTransport } from '../DuplexTransport.js';
import { TCP_SERVER_PORT } from './tcp.js';

export class TcpDevice extends Device {
    private transport: DuplexTransport | undefined;

    public constructor(
        private ip: string,
        mac: string,
        events: DeviceEvents,
    ) {
        super('TCP', ip, mac, events);
    }

    public async connectImpl(_reason: DeviceConnectReason): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new Socket();

            const timeout = setTimeout(() => {
                socket.destroy(new Error('Timed out'));
            }, 1000);

            const cancelTimeout = () => {
                clearTimeout(timeout);
            };

            const onSocketError = (err: Error) => {
                cancelTimeout();
                reject(err);
            };

            socket.once('error', onSocketError);

            socket.once('connect', () => {
                cancelTimeout();

                /*
                 * Error handling is handed off to the transport, remove
                 * the handler here.
                 */
                socket.off('error', onSocketError);

                this.transport = new DuplexTransport(socket, {
                    onData: this.onDataBound,

                    onDisconnected: this.onDisconnectedBound,

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
