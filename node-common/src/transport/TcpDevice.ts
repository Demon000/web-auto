import {
    Device,
    type DeviceEvents,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import { DuplexTransport } from './DuplexTransport.js';
import { Socket } from 'node:net';
import { TCP_SERVER_PORT } from './tcp.js';

export class TcpDevice extends Device {
    public constructor(
        private ip: string,
        events: DeviceEvents,
    ) {
        super('TCP', ip, events);
    }

    public async connectImpl(events: TransportEvents): Promise<Transport> {
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

                const transport = new DuplexTransport(socket, events);

                resolve(transport);
            });

            socket.connect(TCP_SERVER_PORT, this.ip);
        });
    }
}
