import {
    DeviceHandler,
    DeviceHandlerEvent,
    Transport,
} from '@web-auto/android-auto';
import { Socket } from 'node:net';
import { ElectronTcpTransport } from './ElectronTcpTransport';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
    retryMs: number;
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    public constructor(private config: ElectronTcpDeviceHandlerConfig) {
        super();
    }

    private connect(ip: string): void {
        const socket = new Socket();

        console.log(`Connecting to IP ${ip}`);

        let transport: Transport;

        const retry = () => {
            if (transport) {
                this.emitter.emit(DeviceHandlerEvent.DISCONNECTED, transport);
            }
            socket.destroy();
            this.connect(ip);
        };

        const retryLater = () => {
            setTimeout(() => {
                retry();
            }, this.config.retryMs);
        };

        const timeoutId = setTimeout(() => {
            /*
             * Stop trying after retryMs, then restart.
             */
            if (socket.connecting) {
                retry();
            }
        }, this.config.retryMs);

        socket.once('timeout', () => {
            retry();
        });

        socket.once('end', () => {
            retry();
        });

        socket.once('error', (err: NodeJS.ErrnoException) => {
            clearTimeout(timeoutId);

            if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') {
                console.log(
                    `Connection refused, retrying in ${this.config.retryMs}ms`,
                );
                retryLater();
                return;
            } else if (err.code === 'ECONNRESET') {
                console.log(
                    `Connection reset, retrying in ${this.config.retryMs}ms`,
                );
                retryLater();
                return;
            }

            console.log('Connection failed', err);
        });

        socket.once('connect', () => {
            clearTimeout(timeoutId);

            console.log(`Connected to IP ${ip}`);

            transport = new ElectronTcpTransport(socket);
            this.emitter.emit(DeviceHandlerEvent.CONNECTED, transport);
        });

        socket.connect(5277, ip);
    }

    public waitForDevices(): void {
        for (const ip of this.config.ips) {
            this.connect(ip);
        }
    }

    public stopWaitingForDevices(): void {}

    public disconnectDevices(): void {}

    public stop(): void {}
}
