import EventEmitter from 'eventemitter3';
import { Transport, TransportEvent } from './Transport';
import { getLogger } from '@web-auto/logging';
import { Logger } from 'winston';

export enum DeviceEvent {
    CONNECTED,
    DISCONNECTED,
}

export enum DeviceState {
    AVAILABLE,
    CONNECTED,
    DISCONNECTED,
}

export interface DeviceEvents {
    [DeviceEvent.CONNECTED]: () => void;
    [DeviceEvent.DISCONNECTED]: () => void;
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
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);
    }

    public async handleConnect(transport: Transport): Promise<void> {
        this.transport = transport;

        transport.emitter.once(TransportEvent.DISCONNECTED, () => {
            this.emitter.emit(DeviceEvent.DISCONNECTED);
        });

        transport.connect();

        this.state = DeviceState.CONNECTED;

        this.emitter.emit(DeviceEvent.CONNECTED);
    }

    public abstract connect(): Promise<void>;

    public disconnect(): void {
        if (this.state !== DeviceState.CONNECTED) {
            return;
        }

        this.transport?.disconnect();

        this.state = DeviceState.DISCONNECTED;
    }
}
