import { getLogger } from '@web-auto/logging';
import { EventEmitter } from 'eventemitter3';
import { DataBuffer } from '@web-auto/android-auto';
import { BluetoothMessageType } from './BluetoothMessageType';
import {
    ConnectStatusMessage,
    NetworkInfo,
    SocketInfoRequest,
    SocketInfoResponse,
    SocketInfoResponseStatus,
} from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { Duplex } from 'node:stream';
import { Logger } from 'winston';
import { ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig';

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
    private internalEmitter = new EventEmitter<InternalEvents>();
    private timeout?: NodeJS.Timeout;
    private bluetoothSocket?: Duplex;
    protected logger: Logger;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onData = this.onData.bind(this);
        this.onTimeout = this.onTimeout.bind(this);
        this.onStatus = this.onStatus.bind(this);
        this.onFail = this.onFail.bind(this);
    }

    private attachOnData(): void {
        assert(this.bluetoothSocket !== undefined);
        this.bluetoothSocket.on('data', this.onData);
    }

    private detachOnData(): void {
        assert(this.bluetoothSocket !== undefined);
        this.bluetoothSocket.off('data', this.onData);
    }

    private startTimeout(): void {
        this.timeout = setTimeout(this.onTimeout, TIMEOUT);
    }

    private stopTimeout(): void {
        clearTimeout(this.timeout);
    }

    private onTimeout(): void {
        this.detachOnData();

        this.internalEmitter.emit(
            InternalEvent.CONNECTION_FAIL,
            new Error('Timed out'),
        );
    }

    private onFail(err: Error): void {
        this.detachOnData();
        this.stopTimeout();

        this.internalEmitter.emit(InternalEvent.CONNECTION_FAIL, err);
    }

    private onStatus(data: ConnectStatusMessage): void {
        this.detachOnData();
        this.stopTimeout();

        if (data.status === 0) {
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

    public onError(err: Error): void {
        this.logger.debug('Error', {
            metadata: err,
        });
    }

    public payloadToData(
        type: BluetoothMessageType,
        payload: DataBuffer,
    ): DataBuffer {
        const buffer = DataBuffer.empty();

        buffer.appendUint16BE(payload.size);
        buffer.appendUint16BE(type);
        buffer.appendBuffer(payload);

        return buffer;
    }

    public dataToPayload(
        buffer: DataBuffer,
    ): [BluetoothMessageType, DataBuffer] {
        const size = buffer.readUint16BE();
        const type = buffer.readUint16BE();
        const payload = buffer.readBuffer(size);
        return [type, payload];
    }

    public async sendMessage(
        type: BluetoothMessageType,
        payload: DataBuffer,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            assert(this.bluetoothSocket !== undefined);

            this.logger.debug('Send encoded message', {
                metadata: {
                    type: BluetoothMessageType[type],
                    payload,
                },
            });

            const buffer = this.payloadToData(type, payload);

            this.logger.debug('Send data', {
                metadata: buffer.data,
            });

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
            metadata: {
                type: BluetoothMessageType[
                    BluetoothMessageType.SOCKET_INFO_REQUEST
                ],
                data,
            },
        });

        await this.sendMessage(
            BluetoothMessageType.SOCKET_INFO_REQUEST,
            DataBuffer.fromBuffer(SocketInfoRequest.encode(data).finish()),
        );
    }

    public async sendNetworkInfoResponse(): Promise<void> {
        const data = NetworkInfo.create(this.config.networkInfo);

        this.logger.debug('Send message', {
            metadata: {
                type: BluetoothMessageType[
                    BluetoothMessageType.NETWORK_INFO_RESPONSE
                ],
                data,
            },
        });

        await this.sendMessage(
            BluetoothMessageType.NETWORK_INFO_RESPONSE,
            DataBuffer.fromBuffer(NetworkInfo.encode(data).finish()),
        );
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

    public async onMessage(
        type: BluetoothMessageType,
        payload: DataBuffer,
    ): Promise<void> {
        let data;

        this.logger.debug('Receive message', {
            metadata: {
                type: BluetoothMessageType[type],
                payload,
            },
        });

        switch (type) {
            case BluetoothMessageType.NETWORK_INFO_REQUEST:
                this.onNetworkInfoRequest();
                break;
            case BluetoothMessageType.SOCKET_INFO_RESPONSE:
                data = SocketInfoResponse.decode(payload.data);
                this.logger.debug('Receive decoded message', {
                    metadata: {
                        type: BluetoothMessageType[type],
                        data,
                    },
                });
                break;
            case BluetoothMessageType.CONNECT_STATUS:
                data = ConnectStatusMessage.decode(payload.data);
                this.logger.debug('Receive decoded message', {
                    metadata: {
                        type: BluetoothMessageType[type],
                        data,
                    },
                });
                this.onStatus(data);
                break;
            default:
                this.logger.error('Receive unhandled message', {
                    metadata: {
                        type: BluetoothMessageType[type],
                        payload,
                    },
                });
                break;
        }
    }

    private async onData(data: Buffer): Promise<void> {
        this.logger.debug('Receive data', {
            metadata: data,
        });

        const buffer = DataBuffer.fromBuffer(data);

        while (buffer.readBufferSize()) {
            const [type, payload] = this.dataToPayload(buffer);
            await this.onMessage(type, payload);
        }
    }

    public connect(socket: Duplex): Promise<void> {
        this.bluetoothSocket = socket;

        this.attachOnData();
        this.startTimeout();

        return new Promise((resolve, reject) => {
            this.internalEmitter.once(InternalEvent.CONNECTION_FAIL, (err) => {
                this.internalEmitter.removeAllListeners();
                reject(err);
            });

            this.internalEmitter.once(InternalEvent.CONNECTION_SUCCESS, () => {
                this.internalEmitter.removeAllListeners();
                resolve();
            });

            this.sendSocketInfoRequest().catch(this.onFail);
        });
    }
}
