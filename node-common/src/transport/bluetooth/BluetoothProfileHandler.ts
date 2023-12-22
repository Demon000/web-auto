import assert from 'assert';
import { Duplex } from 'node:stream';
import BluetoothSocket from 'bluetooth-socket';
import { getLogger, type LoggerWrapper } from '@web-auto/logging';

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

    public constructor(
        private events: BluetoothProfileEvents,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onDisconnect = this.onDisconnect.bind(this);
        this.onError = this.onError.bind(this);
    }

    private onDisconnect(): void {
        assert(this.socket !== undefined);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.off('error', this.onError);

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

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.once('error', this.onError);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.socket.once('close', this.onDisconnect);

        if (this.connectionCallback === undefined) {
            this.logger.info('Connection expected');
            this.events.onUnhandledConnection(this.socket);
        } else {
            this.logger.info('Connection unexpected');
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
