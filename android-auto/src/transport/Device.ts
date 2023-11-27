import EventEmitter from 'eventemitter3';
import { Transport, TransportEvent } from './Transport';
import { getLogger } from '@web-auto/logging';
import { Logger } from 'winston';
import assert from 'node:assert';

export enum DeviceEvent {
    STATE_UPDATED = 'state-updated',
    DISCONNECTED = 'disconnected',
}

export enum DeviceState {
    AVAILABLE = 'available',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTING = 'disconnecting',
    DISCONNECTED = 'disconnected',
}

export interface DeviceEvents {
    [DeviceEvent.STATE_UPDATED]: (device: Device) => void;
    [DeviceEvent.DISCONNECTED]: () => void;
}

export enum DeviceDisconnectReason {
    TRANSPORT = 'transport-disconnected',
    USER = 'user-requested',
}

export abstract class Device {
    public emitter = new EventEmitter<DeviceEvents>();
    public transport?: Transport;
    public state = DeviceState.AVAILABLE;
    public name: string;
    protected logger: Logger;

    public constructor(
        public prefix: string,
        public realName: string,
        private canReconnect: boolean,
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);

        this.onTransportDisconnect = this.onTransportDisconnect.bind(this);
    }

    protected abstract connectImpl(): Promise<Transport>;
    protected async handleDisconnect(_reason: string): Promise<void> {}

    protected setState(state: DeviceState): void {
        this.state = state;
        this.emitter.emit(DeviceEvent.STATE_UPDATED, this);
    }

    protected resetState(): void {
        if (this.canReconnect) {
            this.setState(DeviceState.AVAILABLE);
        } else {
            this.setState(DeviceState.DISCONNECTED);
        }
    }

    public async connect(): Promise<Transport> {
        if (this.state !== DeviceState.AVAILABLE) {
            this.logger.error(
                `Tried to connect while device has state ${this.state}`,
            );
            throw new Error('Device not availalbe');
        }

        this.setState(DeviceState.CONNECTING);

        try {
            this.transport = await this.connectImpl();
        } catch (err) {
            this.resetState();
            throw err;
        }

        this.transport.emitter.once(
            TransportEvent.DISCONNECTED,
            this.onTransportDisconnect,
        );

        await this.transport.connect();

        this.setState(DeviceState.CONNECTED);

        return this.transport;
    }

    protected async onTransportDisconnect(): Promise<void> {
        await this.disconnect(DeviceDisconnectReason.TRANSPORT);
    }

    public async disconnect(reason?: string): Promise<void> {
        if (reason === undefined) {
            reason = DeviceDisconnectReason.USER;
        }

        this.logger.info(`Disconnecting with reason ${reason}`);

        if (this.state !== DeviceState.CONNECTED) {
            this.logger.error(
                `Tried to disconnect while device has state ${this.state}`,
            );
            return;
        }

        this.setState(DeviceState.DISCONNECTING);

        assert(this.transport !== undefined);
        this.transport.emitter.off(
            TransportEvent.DISCONNECTED,
            this.onTransportDisconnect,
        );

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
        await this.handleDisconnect(reason);

        this.resetState();

        if (reason !== (DeviceDisconnectReason.USER as string)) {
            this.emitter.emit(DeviceEvent.DISCONNECTED);
        }
    }
}
