import { Device, Transport } from '@web-auto/android-auto';
import { ElectronDuplexTransport } from './ElectronDuplexTransport';
import { Socket } from 'node:net';

export class TcpDevice extends Device {
    public constructor(private ip: string) {
        super('TCP', ip, true);
    }

    public async connectImpl(): Promise<Transport> {
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

                const transport = new ElectronDuplexTransport(socket);

                resolve(transport);
            });

            socket.connect(5277, this.ip);
        });
    }
}
