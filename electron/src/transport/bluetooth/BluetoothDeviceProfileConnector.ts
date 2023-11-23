import { EventEmitter } from 'eventemitter3';
import { Device as BluezDevice } from 'bluez';
import { BluetoothProfile, BluetoothProfileEvent } from './BluetoothProfile';
import { Duplex } from 'node:stream';
import { getLogger } from '@web-auto/logging';
import { Logger } from 'winston';

enum InternalEvent {
    CONNECTION_SUCCESS,
    CONNECTION_FAIL,
}

interface InternalEvents {
    [InternalEvent.CONNECTION_SUCCESS]: (socket: Duplex) => void;
    [InternalEvent.CONNECTION_FAIL]: (err: Error) => void;
}

export enum BluetoothDeviceProfileConnectorEvent {
    DISCONNECTED,
}

export interface BluetoothDeviceProfileConnectorEvents {
    [BluetoothDeviceProfileConnectorEvent.DISCONNECTED]: () => void;
}

const TIMEOUT = 10000;

export class BluetoothDeviceProfileConnector {
    public emitter = new EventEmitter<BluetoothDeviceProfileConnectorEvents>();
    private internalEmitter = new EventEmitter<InternalEvents>();
    private timeout?: NodeJS.Timeout;
    protected logger: Logger;

    public constructor(
        private device: BluezDevice,
        private profile: BluetoothProfile,
        private address: string,
        private name: string,
    ) {
        this.onTimeout = this.onTimeout.bind(this);
        this.onFail = this.onFail.bind(this);
        this.onConnect = this.onConnect.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);

        this.logger = getLogger(`${this.constructor.name}@${this.name}`);
    }

    private attachOnConnect(): void {
        this.profile.emitter.once(
            BluetoothProfileEvent.CONNECTED,
            this.onConnect,
        );
    }

    private detachOnConnect(): void {
        this.profile.emitter.off(
            BluetoothProfileEvent.CONNECTED,
            this.onConnect,
        );
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

    private onFail(err: Error): void {
        this.detachOnConnect();
        this.stopTimeout();

        this.internalEmitter.emit(InternalEvent.CONNECTION_FAIL, err);
    }

    private onConnect(address: string, socket: Duplex): void {
        if (this.address !== address) {
            return;
        }

        this.stopTimeout();

        this.logger.debug('Bluetooth profile connected');

        this.profile.emitter.once(
            BluetoothProfileEvent.DISCONNECTED,
            this.onDisconnect,
        );

        this.internalEmitter.emit(InternalEvent.CONNECTION_SUCCESS, socket);
    }

    private onDisconnect(address: string): void {
        if (address !== this.address) {
            return;
        }

        this.logger.debug('Bluetooth profile disconnected');
        this.emitter.emit(BluetoothDeviceProfileConnectorEvent.DISCONNECTED);
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

            this.device.Connect().catch(this.onFail);
        });
    }
}
