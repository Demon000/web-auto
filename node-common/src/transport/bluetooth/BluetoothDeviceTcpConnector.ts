import { EventEmitter } from 'eventemitter3';
import { Duplex } from 'node:stream';
import { LoggerWrapper, getLogger } from '@web-auto/logging';
import { Server, Socket } from 'node:net';

enum InternalEvent {
    CONNECTION_SUCCESS,
    CONNECTION_FAIL,
}

interface InternalEvents {
    [InternalEvent.CONNECTION_SUCCESS]: (socket: Duplex) => void;
    [InternalEvent.CONNECTION_FAIL]: (err: Error) => void;
}

export class BluetoothDeviceTcpConnector {
    private internalEmitter = new EventEmitter<InternalEvents>();
    protected logger: LoggerWrapper;

    public constructor(
        private tcpServer: Server,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onConnect = this.onConnect.bind(this);
    }

    public onConnect(socket: Socket): void {
        this.logger.debug('TCP socket connected');

        this.internalEmitter.emit(InternalEvent.CONNECTION_SUCCESS, socket);
    }

    public async connectWithTimeout(timeoutMs: number): Promise<Duplex> {
        const timeout = setTimeout(() => {
            this.internalEmitter.emit(
                InternalEvent.CONNECTION_FAIL,
                new Error('Timed out'),
            );
        }, timeoutMs);

        const cleanup = () => {
            this.internalEmitter.removeAllListeners();
            clearTimeout(timeout);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.tcpServer.off('connection', this.onConnect);
        };

        return new Promise<Duplex>((resolve, reject) => {
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

            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.tcpServer.once('connection', this.onConnect);
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
}
