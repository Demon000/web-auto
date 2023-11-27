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
    [DeviceEvent.STATE_UPDATED]: () => void;
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
        this.emitter.emit(DeviceEvent.STATE_UPDATED);
    }

    public async connect(): Promise<Transport> {
        if (this.state !== DeviceState.AVAILABLE) {
            this.logger.error(
                `Tried to connect while device has state ${this.state}`,
            );
            throw new Error('Device not availalbe');
        }

        this.setState(DeviceState.CONNECTING);

        this.transport = await this.connectImpl();

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
            await this.transport.disconnect();
            this.logger.info('Disconnected transport');
        }

        this.transport = undefined;
        await this.handleDisconnect(reason);

        if (this.canReconnect) {
            this.logger.info('Device can reconnect, set state to available');
            this.setState(DeviceState.AVAILABLE);
        } else {
            this.logger.info('Device cannot reconnect, set state to available');
            this.setState(DeviceState.DISCONNECTED);
        }

        if (reason !== (DeviceDisconnectReason.USER as string)) {
            this.emitter.emit(DeviceEvent.DISCONNECTED);
        }
    }
}
