import { DeviceHandler, DeviceHandlerEvent } from '@web-auto/android-auto';
import { Socket } from 'node:net';
import { ElectronDuplexTransport } from './ElectronDuplexTransport';
import { getLogger } from '@web-auto/logging';
import assert from 'node:assert';

export interface ElectronTcpDeviceHandlerConfig {
    ips: string[];
    retryMs: number;
}

export class ElectronTcpDeviceHandler extends DeviceHandler {
    private logger = getLogger(this.constructor.name);
    private ipTimeoutMap = new Map<string, NodeJS.Timeout>();
    private id = 0;

    public constructor(private config: ElectronTcpDeviceHandlerConfig) {
        super();
    }

    private setIpTimeout(ip: string, fn: () => void): void {
        assert(!this.ipTimeoutMap.has(ip));
        const timeout = setTimeout(fn, this.config.retryMs);
        this.ipTimeoutMap.set(ip, timeout);
    }

    private clearIpTimeout(ip: string): void {
        const timeout = this.ipTimeoutMap.get(ip);
        assert(timeout !== undefined);
        clearTimeout(timeout);
        this.ipTimeoutMap.delete(ip);
    }

    private connect(ip: string): void {
        const socket = new Socket();

        this.logger.info(`Connecting to IP ${ip}`);

        const onSocketClose = () => {
            this.setIpTimeout(ip, () => {
                this.clearIpTimeout(ip);
                this.connect(ip);
            });
        };

        socket.once('close', onSocketClose);

        /*
         * If socket errored, log the error. The close event will be called
         * right after to retry the connection and clear the current timeout.
         */
        const onSocketError = (err: Error) => {
            this.logger.error(`Connection failed to ${ip}`, {
                metadata: err,
            });
        };

        socket.once('error', onSocketError);

        socket.once('connect', () => {
            this.logger.info(`Connected to IP ${ip}`);

            const address = socket.address();
            let name = 'TCP: ';

            if ('address' in address) {
                name += address.address;
            } else {
                name += this.id;
            }

            const transport = new ElectronDuplexTransport(name, socket);
            /*
             * Error handling is handed off to the socket transport, remove
             * the handler here.
             */
            socket.off('error', onSocketError);

            this.emitter.emit(DeviceHandlerEvent.AVAILABLE, transport);
        });

        socket.connect(5277, ip);
    }

    public waitForDevice(ip: string): void {
        this.connect(ip);
    }

    public waitForDevices(): void {
        for (const ip of this.config.ips) {
            this.waitForDevice(ip);
        }
    }

    public stopWaitingForDevices(): void {
        for (const ip of this.ipTimeoutMap.keys()) {
            this.clearIpTimeout(ip);
        }
    }
}
