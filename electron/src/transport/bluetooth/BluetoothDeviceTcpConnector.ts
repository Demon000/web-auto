import { EventEmitter } from 'eventemitter3';
import { Duplex } from 'node:stream';
import { getLogger } from '@web-auto/logging';
import { Logger } from 'winston';
import { Server, Socket } from 'node:net';

enum InternalEvent {
    CONNECTION_SUCCESS,
    CONNECTION_FAIL,
}

interface InternalEvents {
    [InternalEvent.CONNECTION_SUCCESS]: (socket: Duplex) => void;
    [InternalEvent.CONNECTION_FAIL]: (err: Error) => void;
}

export enum BluetoothDeviceTcpConnectorEvent {
    DISCONNECTED,
}

export interface BluetoothDeviceTcpConnectorEvents {
    [BluetoothDeviceTcpConnectorEvent.DISCONNECTED]: () => void;
}

const TIMEOUT = 10000;

export class BluetoothDeviceTcpConnector {
    public emitter = new EventEmitter<BluetoothDeviceTcpConnectorEvents>();
    private internalEmitter = new EventEmitter<InternalEvents>();
    private timeout?: NodeJS.Timeout;
    protected logger: Logger;

    public constructor(
        private tcpServer: Server,
        private name: string,
    ) {
        this.onTimeout = this.onTimeout.bind(this);
        this.onConnect = this.onConnect.bind(this);

        this.logger = getLogger(`${this.constructor.name}@${this.name}`);
    }

    private attachOnConnect(): void {
        this.tcpServer.once('connection', this.onConnect);
    }

    private detachOnConnect(): void {
        this.tcpServer.off('connection', this.onConnect);
    }

    private startTimeout(): void {
        this.timeout = setTimeout(this.onTimeout, TIMEOUT);
    }

    private stopTimeout(): void {
        clearTimeout(this.timeout);
    }

    private onTimeout(): void {
        this.detachOnConnect();

        this.internalEmitter.emit(
            InternalEvent.CONNECTION_FAIL,
            new Error('Timed out'),
        );
    }

    private onConnect(socket: Socket): void {
        this.stopTimeout();

        this.logger.debug('TCP socket connected');

        this.internalEmitter.emit(InternalEvent.CONNECTION_SUCCESS, socket);
    }

    public async connect(): Promise<Duplex> {
        this.attachOnConnect();
        this.startTimeout();

        return new Promise((resolve, reject) => {
            this.internalEmitter.once(InternalEvent.CONNECTION_FAIL, (err) => {
                this.internalEmitter.removeAllListeners();
                reject(err);
            });

            this.internalEmitter.once(
                InternalEvent.CONNECTION_SUCCESS,
                (socket) => {
                    this.internalEmitter.removeAllListeners();
                    resolve(socket);
                },
            );
        });
    }
}
