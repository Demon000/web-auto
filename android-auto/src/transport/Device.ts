import { Transport, TransportEvents } from './Transport';
import { getLogger } from '@web-auto/logging';
import { Logger } from 'winston';
import assert from 'node:assert';
import { DataBuffer } from '@/utils/DataBuffer';

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
    onDisconnect: (device: Device) => Promise<void>;
    onDisconnected: (device: Device) => Promise<void>;
    onTransportData: (device: Device, buffer: DataBuffer) => Promise<void>;
    onTransportError: (device: Device, err: Error) => Promise<void>;
}

export enum DeviceDisconnectReason {
    TRANSPORT = 'transport-disconnected',
    USER = 'user-requested',
}

export abstract class Device {
    public transport?: Transport;
    public state = DeviceState.AVAILABLE;
    public name: string;
    protected logger: Logger;

    public constructor(
        public prefix: string,
        public realName: string,
        protected events: DeviceEvents,
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);

        this.onTransportData = this.onTransportData.bind(this);
        this.onTransportError = this.onTransportError.bind(this);
        this.onTransportDisconnected = this.onTransportDisconnected.bind(this);
    }

    protected abstract connectImpl(events: TransportEvents): Promise<Transport>;
    protected async handleDisconnect(_reason: string): Promise<void> {}

    protected async setState(state: DeviceState): Promise<void> {
        this.state = state;
        try {
            await this.events.onStateUpdated(this);
        } catch (err) {
            this.logger.error('Failed to emit state updated event', {
                metadata: err,
            });
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
                onData: this.onTransportData,
                onError: this.onTransportError,
                onDisconnected: this.onTransportDisconnected,
            });
        } catch (err) {
            this.logger.error('Failed to connect', {
                metadata: err,
            });
            await this.setState(DeviceState.AVAILABLE);
            throw err;
        }

        await this.transport.connect();

        await this.setState(DeviceState.CONNECTED);

        try {
            await this.events.onConnected(this);
        } catch (err) {
            this.logger.error('Failed to emit connected event', {
                metadata: err,
            });
        }
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
            await this.events.onDisconnect(this);
        } catch (err) {
            this.logger.error('Failed to emit disconnect event', {
                metadata: err,
            });
        }

        await this.setState(DeviceState.DISCONNECTING);

        assert(this.transport !== undefined);

        if (reason !== (DeviceDisconnectReason.TRANSPORT as string)) {
            this.logger.info('Disconnecting transport');
            try {
                await this.transport.disconnect();

                this.logger.info('Disconnected transport');
            } catch (err) {
                this.logger.error('Failed to disconnect transport', {
                    metadata: err,
                });
            }
        }

        this.transport = undefined;
        try {
            await this.handleDisconnect(reason);
        } catch (err) {
            this.logger.error('Failed to handle disconnect', {
                metadata: err,
            });
        }

        try {
            await this.events.onDisconnected(this);
        } catch (err) {
            this.logger.error('Failed to emit disconnected event', {
                metadata: err,
            });
        }

        await this.setState(DeviceState.AVAILABLE);
    }
}
