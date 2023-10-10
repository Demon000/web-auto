import { DeviceHandler, DeviceHandlerEvent } from '@web-auto/android-auto';
import { Socket } from 'node:net';
import { ElectronTcpTransport } from './ElectronTcpTransport';
import { getLogger } from '@web-auto/logging';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
    retryMs: number;
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    private logger = getLogger(this.constructor.name);
    private ipTimeoutMap = new Map<string, NodeJS.Timeout>();
    private ipSocketMap = new Map<string, Socket>();

    public constructor(private config: ElectronTcpDeviceHandlerConfig) {
        super();
    }

    private setIpTimeout(ip: string, fn: () => void): void {
        const timeout = setTimeout(fn, this.config.retryMs);
        this.ipTimeoutMap.set(ip, timeout);
    }

    private clearIpTimeout(ip: string): void {
        const timeout = this.ipTimeoutMap.get(ip);
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
        this.ipTimeoutMap.delete(ip);
    }

    private connect(ip: string): void {
        const socket = new Socket();

        this.logger.info(`Connecting to IP ${ip}`);

        /*
         * Set a connection timeout since sockets can take a long time trying
         * to connect.
         * Once connected, or on error, this timeout is canceled.
         */
        this.setIpTimeout(ip, () => {
            if (socket.connecting) {
                socket.destroy();
                this.connect(ip);
            }
        });

        socket.once('close', () => {
            this.clearIpTimeout(ip);

            this.setIpTimeout(ip, () => {
                this.connect(ip);
            });
        });

        socket.once('error', (err) => {
            this.clearIpTimeout(ip);

            this.logger.error(`Connection failed to ${ip}`, {
                metadata: err,
            });
        });

        socket.once('connect', () => {
            this.clearIpTimeout(ip);

            this.ipSocketMap.set(ip, socket);

            this.logger.info(`Connected to IP ${ip}`);

            const transport = new ElectronTcpTransport(socket);

            const disconnected = () => {
                this.ipSocketMap.delete(ip);
                this.emitter.emit(DeviceHandlerEvent.DISCONNECTED, transport);
            };

            socket.prependOnceListener('close', disconnected);
            socket.prependOnceListener('error', disconnected);

            this.emitter.emit(DeviceHandlerEvent.CONNECTED, transport);
        });

        socket.connect(5277, ip);
    }

    public waitForDevices(): void {
        for (const ip of this.config.ips) {
            this.connect(ip);
        }
    }

    public stopWaitingForDevices(): void {
        for (const ip of this.ipTimeoutMap.keys()) {
            this.clearIpTimeout(ip);
        }
    }

    public disconnectDevices(): void {
        for (const socket of this.ipSocketMap.values()) {
            socket.destroy();
        }
    }
}
