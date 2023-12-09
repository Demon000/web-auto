import assert from 'assert';
import { Duplex } from 'node:stream';
import BluetoothSocket from 'bluetooth-socket';

export interface BluetoothProfileEvents {
    onUnhandledConnection: (socket: BluetoothSocket) => Promise<void>;
    onUnhandledDisconnected: () => Promise<void>;
    onError: (err: Error) => void;
}

export class BluetoothProfileHandler {
    public socket?: BluetoothSocket;
    private connectionCallback?: (socket: Duplex) => void;
    private disconnectionCallback?: () => void;

    public constructor(private events: BluetoothProfileEvents) {
        this.onDisconnect = this.onDisconnect.bind(this);
        this.onError = this.onError.bind(this);
    }

    private async onDisconnect(): Promise<void> {
        assert(this.socket !== undefined);

        this.socket.off('error', this.onError);

        this.socket = undefined;

        if (this.disconnectionCallback === undefined) {
            await this.events.onUnhandledDisconnected();
        } else {
            this.disconnectionCallback();
        }
    }

    private onError(err: Error): void {
        this.events.onError(err);
    }

    public async connect(fd: number): Promise<void> {
        assert(this.socket === undefined);

        this.socket = new BluetoothSocket(fd);

        this.socket.once('error', this.onError);
        this.socket.once('close', this.onDisconnect);

        if (this.connectionCallback === undefined) {
            await this.events.onUnhandledConnection(this.socket);
        } else {
            this.connectionCallback(this.socket);
        }
    }

    public waitForDisconnection(signal?: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            assert(this.disconnectionCallback === undefined);

            const onAbort = () => {
                this.disconnectionCallback = undefined;
                reject(new Error('Aborted'));
            };

            const onDisconnect = () => {
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
                this.connectionCallback = undefined;
                reject(new Error('Aborted'));
            };

            const onConnect = (socket: Duplex) => {
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
