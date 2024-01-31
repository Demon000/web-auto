import { Transport, type TransportEvents } from './Transport.js';
import { LoggerWrapper, getLogger } from '@web-auto/logging';
import { Mutex } from 'async-mutex';

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
    onData: (device: Device, buffer: Uint8Array) => void;
    onError: (device: Device, err: Error) => void;
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
    protected mutex = new Mutex();

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

    public async send(buffer: Uint8Array): Promise<void> {
        if (this.transport === undefined) {
            this.logger.error('Device has no transport');
            return;
        }

        return this.transport.send(buffer);
    }

    protected setState(state: DeviceState): void {
        this.state = state;
        try {
            this.events.onStateUpdated(this);
        } catch (err) {
            this.logger.error('Failed to emit state updated event', err);
        }
    }

    public async connect(): Promise<void> {
        const release = await this.mutex.acquire();

        if (
            this.state !== DeviceState.AVAILABLE &&
            this.state !== DeviceState.SELF_CONNECTING
        ) {
            this.logger.error(
                `Tried to connect while device has state ${this.state}`,
            );
            release();
            throw new Error('Device not availalbe');
        }

        this.setState(DeviceState.CONNECTING);

        try {
            this.transport = await this.connectImpl({
                onData: this.onData.bind(this),
                onError: this.onError.bind(this),
                onDisconnected: this.onTransportDisconnected.bind(this),
            });
        } catch (err) {
            this.logger.error('Failed to connect', err);
            this.setState(DeviceState.AVAILABLE);
            release();
            throw err;
        }

        this.setState(DeviceState.CONNECTED);
        release();
    }

    protected onData(data: Uint8Array): void {
        this.events.onData(this, data);
    }

    protected onError(err: Error): void {
        this.events.onError(this, err);
    }

    protected onTransportDisconnected(): void {
        this.selfDisconnect(DeviceDisconnectReason.TRANSPORT);
    }

    public selfDisconnect(reason: string): void {
        this.events.onSelfDisconnection(this, reason);
    }

    public async disconnect(reason?: string): Promise<void> {
        const release = await this.mutex.acquire();
        if (reason === undefined) {
            reason = DeviceDisconnectReason.USER;
        }

        if (this.state !== DeviceState.CONNECTED) {
            this.logger.info(
                `Tried to disconnect while device has state ${this.state}`,
            );
            release();
            return;
        }

        this.logger.info(`Disconnecting with reason ${reason}`);

        this.setState(DeviceState.DISCONNECTING);

        if (this.transport === undefined) {
            release();
            throw new Error('Cannot disconnect a device that is not connected');
        }

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

        release();
    }
}
