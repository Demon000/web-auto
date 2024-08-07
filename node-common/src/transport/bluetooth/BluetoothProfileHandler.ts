import { Duplex } from 'node:stream';

import { getLogger, type LoggerWrapper } from '@web-auto/logging';
import assert from 'assert';
import BluetoothSocket from 'bluetooth-socket';

export interface BluetoothProfileEvents {
    onUnhandledConnection: (socket: BluetoothSocket) => void;
    onUnhandledDisconnected: () => void;
    onError: (err: Error) => void;
}

export class BluetoothProfileHandler {
    public socket: BluetoothSocket | undefined;
    private connectionCallback: ((socket: Duplex) => void) | undefined;
    private disconnectionCallback: (() => void) | undefined;
    protected logger: LoggerWrapper;
    private onErrorBound: (err: Error) => void;
    private onDisconnectBound: () => void;

    public constructor(
        private events: BluetoothProfileEvents,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onDisconnectBound = this.onDisconnect.bind(this);
        this.onErrorBound = this.onError.bind(this);
    }

    private onDisconnect(): void {
        assert(this.socket !== undefined);

        this.socket.off('error', this.onErrorBound);

        this.socket = undefined;

        if (this.disconnectionCallback === undefined) {
            this.events.onUnhandledDisconnected();
        } else {
            this.disconnectionCallback();
        }
    }

    private onError(err: Error): void {
        this.events.onError(err);
    }

    public connect(fd: number): void {
        assert(this.socket === undefined);

        this.socket = new BluetoothSocket(fd);

        this.socket.once('error', this.onErrorBound);
        this.socket.once('close', this.onDisconnectBound);

        if (this.connectionCallback === undefined) {
            this.logger.info('Connection unexpected');
            this.events.onUnhandledConnection(this.socket);
        } else {
            this.logger.info('Connection expected');
            this.connectionCallback(this.socket);
        }
    }

    public waitForDisconnection(signal?: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            assert(this.disconnectionCallback === undefined);

            const onAbort = () => {
                this.logger.info('Aborted wait for disconnection');
                this.disconnectionCallback = undefined;
                reject(new Error('Aborted'));
            };

            const onDisconnect = () => {
                this.logger.info('Received disconnection event');
                this.disconnectionCallback = undefined;
                signal?.removeEventListener('abort', onAbort);
                resolve();
            };

            signal?.addEventListener('abort', onAbort);

            this.disconnectionCallback = onDisconnect;
        });
    }

    private waitForConnection(signal?: AbortSignal): Promise<Duplex> {
        return new Promise((resolve, reject) => {
            if (this.socket !== undefined) {
                return resolve(this.socket);
            }

            assert(this.connectionCallback === undefined);

            const onAbort = () => {
                this.logger.info('Aborted wait for connection');
                this.connectionCallback = undefined;
                reject(new Error('Aborted'));
            };

            const onConnect = (socket: Duplex) => {
                this.logger.info('Received connection event');
                this.connectionCallback = undefined;
                signal?.removeEventListener('abort', onAbort);
                resolve(socket);
            };

            signal?.addEventListener('abort', onAbort);

            this.connectionCallback = onConnect;
        });
    }

    public async waitForConnectionWithTimeout(ms: number): Promise<Duplex> {
        const signal = AbortSignal.timeout(ms);

        return this.waitForConnection(signal);
    }

    public async disconnect(): Promise<void> {
        assert(this.socket !== undefined);

        this.socket.destroy();

        return this.waitForDisconnection();
    }
}
