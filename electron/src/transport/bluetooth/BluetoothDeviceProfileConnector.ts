import { EventEmitter } from 'eventemitter3';
import { Duplex } from 'node:stream';
import assert from 'node:assert';
import BluetoothSocket from 'bluetooth-socket';

enum InternalEvent {
    CONNECTION_SUCCESS,
    CONNECTION_FAIL,
    DISCONNECTION_SUCCESS,
    DISCONNECTION_FAIL,
}

interface InternalEvents {
    [InternalEvent.CONNECTION_SUCCESS]: (socket: Duplex) => void;
    [InternalEvent.CONNECTION_FAIL]: (err: Error) => void;
    [InternalEvent.DISCONNECTION_SUCCESS]: () => void;
    [InternalEvent.DISCONNECTION_FAIL]: (err: Error) => void;
}

const TIMEOUT = 10000;

export class BluetoothDeviceProfileConnector {
    private internalEmitter = new EventEmitter<InternalEvents>();
    private socket?: Duplex;

    public onConnect(socket: BluetoothSocket): void {
        assert(this.socket === undefined);
        this.socket = socket;

        this.internalEmitter.emit(InternalEvent.CONNECTION_SUCCESS, socket);
    }

    public async onDisconnect(): Promise<void> {
        assert(this.socket !== undefined);
        this.socket = undefined;

        this.internalEmitter.emit(
            InternalEvent.CONNECTION_FAIL,
            new Error('Bluetooth disconnected'),
        );
        this.internalEmitter.emit(InternalEvent.DISCONNECTION_SUCCESS);
    }

    public async connect(): Promise<Duplex> {
        if (this.socket !== undefined) {
            return this.socket;
        }

        const timeout = setTimeout(() => {
            this.internalEmitter.emit(
                InternalEvent.CONNECTION_FAIL,
                new Error('Timed out'),
            );
        }, TIMEOUT);

        const cleanup = () => {
            this.internalEmitter.removeAllListeners();
            clearTimeout(timeout);
        };

        return new Promise<Duplex>((resolve, reject) => {
            this.internalEmitter.once(InternalEvent.CONNECTION_FAIL, reject);

            this.internalEmitter.once(
                InternalEvent.CONNECTION_SUCCESS,
                resolve,
            );
        })
            .then((socket) => {
                cleanup();
                return socket;
            })
            .catch((err) => {
                cleanup();
                throw err;
            });
    }

    public async disconnect(): Promise<void> {
        const timeout = setTimeout(() => {
            this.internalEmitter.emit(
                InternalEvent.DISCONNECTION_FAIL,
                new Error('Timed out'),
            );
        }, TIMEOUT);

        const cleanup = () => {
            this.internalEmitter.removeAllListeners();
            clearTimeout(timeout);
        };

        return new Promise<void>((resolve, reject) => {
            this.internalEmitter.once(InternalEvent.DISCONNECTION_FAIL, reject);

            this.internalEmitter.once(
                InternalEvent.DISCONNECTION_SUCCESS,
                resolve,
            );

            assert(this.socket !== undefined);
            this.socket.destroy();
        })
            .then(() => {
                cleanup();
            })
            .catch((err) => {
                cleanup();
                throw err;
            });
    }
}
