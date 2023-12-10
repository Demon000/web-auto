import { Transport, type TransportEvents } from './Transport.js';
import { LoggerWrapper, getLogger } from '@web-auto/logging';
import assert from 'node:assert';
import { DataBuffer } from '../utils/DataBuffer.js';

export enum DeviceState {
    AVAILABLE = 'available',
    CONNECTING = 'connecting',
    SELF_CONNECTING = 'self-connecting',
    CONNECTED = 'connected',
    DISCONNECTING = 'disconnecting',
    DISCONNECTED = 'disconnected',
}

export interface DeviceEvents {
    onStateUpdated: (device: Device) => Promise<void>;
    onSelfConnect: (device: Device) => Promise<boolean>;
    onConnected: (device: Device) => Promise<void>;
    onDisconnect: (device: Device, reason: string) => Promise<void>;
    onDisconnected: (device: Device) => Promise<void>;
    onTransportData: (device: Device, buffer: DataBuffer) => Promise<void>;
    onTransportError: (device: Device, err: Error) => Promise<void>;
}

export enum DeviceDisconnectReason {
    TRANSPORT = 'transport-disconnected',
    USER = 'user-requested',
    START_FAILED = 'start-failed',
}

export abstract class Device {
    public transport?: Transport;
    public state = DeviceState.AVAILABLE;
    public name: string;
    protected logger: LoggerWrapper;

    public constructor(
        public prefix: string,
        public realName: string,
        protected events: DeviceEvents,
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);
    }

    protected abstract connectImpl(events: TransportEvents): Promise<Transport>;
    protected async handleDisconnect(_reason: string): Promise<void> {}

    protected async setState(state: DeviceState): Promise<void> {
        this.state = state;
        try {
            await this.events.onStateUpdated(this);
        } catch (err) {
            this.logger.error('Failed to emit state updated event', err);
        }
    }

    public async connect(): Promise<void> {
        if (
            this.state !== DeviceState.AVAILABLE &&
            this.state !== DeviceState.SELF_CONNECTING
        ) {
            this.logger.error(
                `Tried to connect while device has state ${this.state}`,
            );
            throw new Error('Device not availalbe');
        }

        await this.setState(DeviceState.CONNECTING);

        try {
            this.transport = await this.connectImpl({
                onData: this.onTransportData.bind(this),
                onError: this.onTransportError.bind(this),
                onDisconnected: this.onTransportDisconnected.bind(this),
            });
        } catch (err) {
            this.logger.error('Failed to connect', err);
            await this.setState(DeviceState.AVAILABLE);
            throw err;
        }

        await this.transport.connect();

        await this.setState(DeviceState.CONNECTED);

        void this.events.onConnected(this);
    }

    protected async onTransportData(data: DataBuffer): Promise<void> {
        await this.events.onTransportData(this, data);
    }

    protected async onTransportError(err: Error): Promise<void> {
        await this.events.onTransportError(this, err);
    }

    protected async onTransportDisconnected(): Promise<void> {
        await this.disconnect(DeviceDisconnectReason.TRANSPORT);
    }

    public async disconnect(reason?: string): Promise<void> {
        if (reason === undefined) {
            reason = DeviceDisconnectReason.USER;
        }

        this.logger.info(`Disconnecting with reason ${reason}`);

        if (this.state !== DeviceState.CONNECTED) {
            this.logger.info(
                `Tried to disconnect while device has state ${this.state}`,
            );
            return;
        }

        try {
            await this.events.onDisconnect(this, reason);
        } catch (err) {
            this.logger.error('Failed to emit disconnect event', err);
        }

        await this.setState(DeviceState.DISCONNECTING);

        assert(this.transport !== undefined);

        if (reason !== (DeviceDisconnectReason.TRANSPORT as string)) {
            this.logger.info('Disconnecting transport');
            try {
                await this.transport.disconnect();

                this.logger.info('Disconnected transport');
            } catch (err) {
                this.logger.error('Failed to disconnect transport', err);
            }
        }

        this.transport = undefined;
        try {
            await this.handleDisconnect(reason);
        } catch (err) {
            this.logger.error('Failed to handle disconnect', err);
        }

        await this.setState(DeviceState.AVAILABLE);

        void this.events.onDisconnected(this);
    }
}
