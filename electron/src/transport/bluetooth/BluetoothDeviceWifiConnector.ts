import { LoggerWrapper, getLogger } from '@web-auto/logging';
import { EventEmitter } from 'eventemitter3';
import {
    BluetoothMessage,
    BluetoothMessageCodec,
    BluetoothMessageType,
    DataBuffer,
} from '@web-auto/android-auto';
import {
    ConnectStatusMessage,
    NetworkInfo,
    SocketInfoRequest,
    SocketInfoResponse,
    SocketInfoResponseStatus,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { Duplex } from 'node:stream';
import { type ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig.js';

enum InternalEvent {
    CONNECTION_SUCCESS,
    CONNECTION_FAIL,
}

interface InternalEvents {
    [InternalEvent.CONNECTION_SUCCESS]: () => void;
    [InternalEvent.CONNECTION_FAIL]: (err: Error) => void;
}

const TIMEOUT = 20000;

export class BluetoothDeviceWifiConnector {
    private codec = new BluetoothMessageCodec();
    private internalEmitter = new EventEmitter<InternalEvents>();
    private bluetoothSocket?: Duplex;
    protected logger: LoggerWrapper;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onData = this.onData.bind(this);
    }

    private onStatus(data: ConnectStatusMessage): void {
        if (data.status === SocketInfoResponseStatus.Enum.STATUS_SUCCESS) {
            this.internalEmitter.emit(InternalEvent.CONNECTION_SUCCESS);
        } else {
            this.internalEmitter.emit(
                InternalEvent.CONNECTION_FAIL,
                new Error(
                    `Wi-Fi connection failed with ${
                        SocketInfoResponseStatus.Enum[data.status]
                    }`,
                ),
            );
        }
    }

    public async sendMessage(message: BluetoothMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            assert(this.bluetoothSocket !== undefined);

            this.logger.debug('Send encoded message', message);

            const buffer = this.codec.encodeMessage(message);

            this.logger.debug('Send data', buffer);

            this.bluetoothSocket.write(buffer.data, undefined, (err) => {
                if (err === undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }

    public async sendSocketInfoRequest(): Promise<void> {
        const data = SocketInfoRequest.create(this.config.socketInfo);

        this.logger.debug('Send message', {
            type: BluetoothMessageType[
                BluetoothMessageType.SOCKET_INFO_REQUEST
            ],
            data,
        });

        const message = new BluetoothMessage(
            BluetoothMessageType.SOCKET_INFO_REQUEST,
            DataBuffer.fromBuffer(SocketInfoRequest.encode(data).finish()),
        );

        await this.sendMessage(message);
    }

    public async sendNetworkInfoResponse(): Promise<void> {
        const data = this.config.networkInfo;

        this.logger.debug('Send message', {
            type: BluetoothMessageType[
                BluetoothMessageType.NETWORK_INFO_RESPONSE
            ],
            data,
        });

        const message = new BluetoothMessage(
            BluetoothMessageType.NETWORK_INFO_RESPONSE,
            DataBuffer.fromBuffer(NetworkInfo.encode(data).finish()),
        );

        await this.sendMessage(message);
    }

    public async onNetworkInfoRequest(): Promise<void> {
        try {
            await this.sendNetworkInfoResponse();
        } catch (err) {
            this.internalEmitter.emit(
                InternalEvent.CONNECTION_FAIL,
                err as Error,
            );
        }
    }

    public async onMessage(message: BluetoothMessage): Promise<void> {
        let data;

        this.logger.debug('Receive message', message);

        switch (message.type) {
            case BluetoothMessageType.NETWORK_INFO_REQUEST:
                await this.onNetworkInfoRequest();
                break;
            case BluetoothMessageType.SOCKET_INFO_RESPONSE:
                data = SocketInfoResponse.decode(message.payload.data);
                this.logger.debug('Receive decoded message', data);
                break;
            case BluetoothMessageType.CONNECT_STATUS:
                data = ConnectStatusMessage.decode(message.payload.data);
                this.logger.debug('Receive decoded message', data);
                this.onStatus(data);
                break;
            default:
                this.logger.error('Receive unhandled message');
                break;
        }
    }

    private async onData(buffer: Buffer): Promise<void> {
        this.logger.debug('Receive data', buffer);

        const messages = this.codec.decodeBuffer(buffer);
        for (const message of messages) {
            await this.onMessage(message);
        }
    }

    public connect(socket: Duplex): Promise<void> {
        this.bluetoothSocket = socket;

        const timeout = setTimeout(() => {
            this.internalEmitter.emit(
                InternalEvent.CONNECTION_FAIL,
                new Error('Timed out'),
            );
        }, TIMEOUT);

        const cleanup = () => {
            socket.off('data', this.onData);
            this.internalEmitter.removeAllListeners();
            clearTimeout(timeout);
        };

        return new Promise<void>((resolve, reject) => {
            this.internalEmitter.once(InternalEvent.CONNECTION_FAIL, (err) => {
                reject(err);
            });

            this.internalEmitter.once(InternalEvent.CONNECTION_SUCCESS, () => {
                resolve();
            });

            socket.on('data', this.onData);

            this.sendSocketInfoRequest().catch((err) => {
                reject(err);
            });
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
