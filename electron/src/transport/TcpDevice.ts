import { Device, DeviceState } from '@web-auto/android-auto';
import { ElectronDuplexTransport } from './ElectronDuplexTransport';
import { Socket } from 'node:net';

export class TcpDevice extends Device {
    public constructor(private ip: string) {
        super(`TCP: ${ip}`);
    }

    public async connect(): Promise<void> {
        if (this.state !== DeviceState.AVAILABLE) {
            return;
        }

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

                this.handleConnect(transport);

                resolve();
            });

            socket.connect(5277, this.ip);
        });
    }
}
