import { Transport, type TransportEvents } from './Transport.js';
import { LoggerWrapper, getLogger } from '@web-auto/logging';
import assert from 'node:assert';

export enum DeviceState {
    AVAILABLE = 'available',
    CONNECTING = 'connecting',
    SELF_CONNECTING = 'self-connecting',
    CONNECTED = 'connected',
    DISCONNECTING = 'disconnecting',
    DISCONNECTED = 'disconnected',
}

export interface DeviceEvents {
    onStateUpdated: (device: Device) => void;
    onSelfConnection: (device: Device) => void;
    onSelfDisconnection: (device: Device, reason: string) => void;
    onTransportData: (device: Device, buffer: Uint8Array) => void;
    onTransportError: (device: Device, err: Error) => void;
}

export enum DeviceDisconnectReason {
    TRANSPORT = 'transport-disconnected',
    USER = 'user-requested',
    START_FAILED = 'start-failed',
    DO_START_FAILED = 'do-start-failed',
}

export abstract class Device {
    public transport: Transport | undefined;
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
    public async rejectSelfConnection(): Promise<void> {}
    protected async handleDisconnect(_reason: string): Promise<void> {}

    protected setState(state: DeviceState): void {
        this.state = state;
        try {
            this.events.onStateUpdated(this);
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

        this.setState(DeviceState.CONNECTING);

        try {
            this.transport = await this.connectImpl({
                onData: this.onTransportData.bind(this),
                onError: this.onTransportError.bind(this),
                onDisconnected: this.onTransportDisconnected.bind(this),
            });
        } catch (err) {
            this.logger.error('Failed to connect', err);
            this.setState(DeviceState.AVAILABLE);
            throw err;
        }

        await this.transport.connect();

        this.setState(DeviceState.CONNECTED);
    }

    protected onTransportData(data: Uint8Array): void {
        this.events.onTransportData(this, data);
    }

    protected onTransportError(err: Error): void {
        this.events.onTransportError(this, err);
    }

    protected onTransportDisconnected(): void {
        this.selfDisconnect(DeviceDisconnectReason.TRANSPORT);
    }

    public selfDisconnect(reason: string): void {
        this.events.onSelfDisconnection(this, reason);
    }

    public async disconnect(reason?: string): Promise<void> {
        if (reason === undefined) {
            reason = DeviceDisconnectReason.USER;
        }

        if (this.state !== DeviceState.CONNECTED) {
            this.logger.info(
                `Tried to disconnect while device has state ${this.state}`,
            );
            return;
        }

        this.logger.info(`Disconnecting with reason ${reason}`);

        this.setState(DeviceState.DISCONNECTING);

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

        this.setState(DeviceState.AVAILABLE);
    }
}
