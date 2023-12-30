import { LoggerWrapper, getLogger } from '@web-auto/logging';
import {
    BluetoothMessage,
    BluetoothMessageCodec,
    BluetoothMessageType,
} from '@web-auto/android-auto';
import assert from 'node:assert';
import { Duplex } from 'node:stream';
import { type ElectronBluetoothDeviceHandlerConfig } from './BluetoothDeviceHandlerConfig.js';

import {
    SocketInfoRequest,
    NetworkInfo,
    ConnectStatus,
    SocketInfoResponseStatus,
} from '@web-auto/android-auto-proto/bluetooth.js';

type BluetoothMessageCallback = (message: BluetoothMessage) => void;

export class BluetoothDeviceWifiConnector {
    private codec = new BluetoothMessageCodec();
    private bluetoothSocket?: Duplex;
    protected logger: LoggerWrapper;

    private messageCallbacks = new Map<number, BluetoothMessageCallback>();

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private name: string,
    ) {
        this.logger = getLogger(`${this.constructor.name}@${this.name}`);

        this.onData = this.onData.bind(this);
    }

    public async sendMessage(message: BluetoothMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            assert(this.bluetoothSocket !== undefined);

            this.logger.debug('Send encoded message', message);

            const buffer = this.codec.encodeMessage(message);

            this.logger.debug('Send data', buffer);

            this.bluetoothSocket.write(buffer, undefined, (err) => {
                if (err === undefined || err === null) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }

    public async sendSocketInfoRequest(): Promise<void> {
        const data = new SocketInfoRequest(this.config.socketInfo);

        this.logger.debug('Send message', {
            type: BluetoothMessageType[
                BluetoothMessageType.SOCKET_INFO_REQUEST
            ],
            data,
        });

        const message = new BluetoothMessage(
            BluetoothMessageType.SOCKET_INFO_REQUEST,
            data.toBinary(),
        );

        await this.sendMessage(message);
    }

    public async sendNetworkInfoResponse(): Promise<void> {
        const data = new NetworkInfo(this.config.networkInfo);

        this.logger.debug('Send message', {
            type: BluetoothMessageType[
                BluetoothMessageType.NETWORK_INFO_RESPONSE
            ],
            data,
        });

        const message = new BluetoothMessage(
            BluetoothMessageType.NETWORK_INFO_RESPONSE,
            data.toBinary(),
        );

        await this.sendMessage(message);
    }

    private handleMessage(message: BluetoothMessage): boolean {
        const callback = this.messageCallbacks.get(message.type);
        if (callback === undefined) {
            return false;
        } else {
            callback(message);
            return true;
        }
    }

    private waitForMessage(
        type: number,
        signal: AbortSignal,
    ): Promise<BluetoothMessage> {
        return new Promise((resolve, reject) => {
            assert(!this.messageCallbacks.has(type));

            const onAbort = () => {
                this.logger.info(`Aborted wait for message with id ${type}`);
                this.messageCallbacks.delete(type);
                reject(new Error('Aborted'));
            };

            const onMessage = (message: BluetoothMessage) => {
                this.logger.info(`Received waited message with id ${type}`);
                this.messageCallbacks.delete(type);
                signal.removeEventListener('abort', onAbort);
                resolve(message);
            };

            signal.addEventListener('abort', onAbort);

            this.messageCallbacks.set(type, onMessage);
        });
    }

    private onData(buffer: Uint8Array): void {
        this.logger.debug('Receive data', buffer);

        const messages = this.codec.decodeBuffer(buffer);
        for (const message of messages) {
            const handled = this.handleMessage(message);
            if (!handled) {
                this.logger.error('Receive unhandled message', message);
            }
        }
    }

    public async doConnection(abortSignal: AbortSignal): Promise<void> {
        await this.sendSocketInfoRequest();

        await this.waitForMessage(
            BluetoothMessageType.NETWORK_INFO_REQUEST,
            abortSignal,
        );

        await this.sendNetworkInfoResponse();
    }

    public async waitForConnectStatus(abortSignal: AbortSignal): Promise<void> {
        const message = await this.waitForMessage(
            BluetoothMessageType.CONNECT_STATUS,
            abortSignal,
        );

        const data = ConnectStatus.fromBinary(message.payload);

        if (data.status !== SocketInfoResponseStatus.STATUS_SUCCESS) {
            assert(data.status !== undefined);
            throw new Error(
                `Connection failed: ${SocketInfoResponseStatus[data.status]}`,
            );
        }
    }

    public async connectWithTimeout(
        socket: Duplex,
        timeoutMs: number,
    ): Promise<void> {
        this.bluetoothSocket = socket;

        return new Promise((resolve, reject) => {
            const abortController = new AbortController();
            const abortSignal = abortController.signal;

            const timeout = setTimeout(() => {
                abortController.abort();
            }, timeoutMs);

            // eslint-disable-next-line @typescript-eslint/unbound-method
            socket.on('data', this.onData);

            const clearAndAbort = () => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                socket.off('data', this.onData);
                clearTimeout(timeout);
                abortController.abort();
            };

            this.waitForConnectStatus(abortSignal)
                .then(() => {
                    clearAndAbort();
                    resolve();
                })
                .catch((err) => {
                    this.logger.error('Failed waiting for connect status', err);
                    clearAndAbort();
                    reject(err);
                });

            this.doConnection(abortSignal)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed connecting', err);
                    clearAndAbort();
                    reject(err);
                });
        });
    }
}
