import { LoggerWrapper, getLogger } from '@web-auto/logging';
import { Mutex } from 'async-mutex';

export class DeviceCreateIgnoredError extends Error {}

export enum DeviceState {
    UNKNOWN = 'unknown',
    NEEDS_RESET = 'needs-reset',
    AVAILABLE = 'available',
    CONNECTING = 'connecting',
    SELF_CONNECTING = 'self-connecting',
    CONNECTED = 'connected',
    UNSUPPORTED = 'unsupported',
    DISCONNECTING = 'disconnecting',
}

export enum GenericDeviceDisconnectReason {
    USER = 'user',
    START_FAILED = 'start-failed',
    DO_START_FAILED = 'do-start-failed',
    SELF_CONNECT_REFUSED = 'self-connect-refused',
    TRANSPORT_DISCONNECTED = 'transport-disconnected',
    PING_TIMEOUT = 'ping-timeout',
    BYE_BYE = 'bye-bye',
}

export type DeviceDisconnectReason = GenericDeviceDisconnectReason | string;

export enum DeviceConnectReason {
    USER = 'user',
    SELF_CONNECT = 'self-connect',
}

export interface DeviceEvents {
    onStateUpdated: (device: Device) => void;
    onSelfConnection: (device: Device) => void;
    onSelfDisconnection: (
        device: Device,
        reason: DeviceDisconnectReason,
    ) => void;
    onData: (device: Device, buffer: Uint8Array) => void;
    onError: (device: Device, err: Error) => void;
}

export abstract class Device {
    public state = DeviceState.UNKNOWN;
    public name: string;
    protected logger: LoggerWrapper;
    protected mutex = new Mutex();
    protected onDataBound: (data: Uint8Array) => void;
    protected onErrorBound: (err: Error) => void;
    protected onDisconnectedBound: () => void;

    public constructor(
        public prefix: string,
        public realName: string,
        public uniqueId: string,
        protected events: DeviceEvents,
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);

        this.onDataBound = this.onData.bind(this);
        this.onErrorBound = this.onError.bind(this);
        this.onDisconnectedBound = this.onDisconnected.bind(this);
    }

    public async reset(): Promise<void> {}
    protected abstract connectImpl(reason: DeviceConnectReason): Promise<void>;
    protected abstract disconnectImpl(
        reason: DeviceDisconnectReason,
    ): Promise<void>;
    public abstract send(buffer: Uint8Array): void;
    // eslint-disable-next-line @typescript-eslint/require-await
    public async probe(_existing?: true): Promise<void> {
        this.setState(DeviceState.AVAILABLE);
    }

    private callOnStateUpdated(): void {
        try {
            this.events.onStateUpdated(this);
        } catch (err) {
            this.logger.error('Failed to emit state updated event', err);
        }
    }

    protected setState(state: DeviceState): void {
        this.logger.debug(`Switched state from ${this.state} to ${state}`);
        this.state = state;
        this.callOnStateUpdated();
    }

    private async connectLocked(reason: DeviceConnectReason): Promise<void> {
        if (
            this.state !== DeviceState.AVAILABLE &&
            this.state !== DeviceState.SELF_CONNECTING
        ) {
            this.logger.error(
                `Tried to connect while device has state ${this.state}`,
            );
            throw new Error('Device not available');
        }

        this.setState(DeviceState.CONNECTING);

        try {
            await this.connectImpl(reason);
        } catch (err) {
            this.logger.error('Failed to connect', err);
            this.setState(DeviceState.AVAILABLE);
            throw err;
        }

        this.setState(DeviceState.CONNECTED);
    }

    public async connect(reason: DeviceConnectReason): Promise<void> {
        const release = await this.mutex.acquire();

        try {
            await this.connectLocked(reason);
        } finally {
            release();
        }
    }

    public selfConnect(): void {
        this.setState(DeviceState.SELF_CONNECTING);

        this.events.onSelfConnection(this);
    }

    protected onData(data: Uint8Array): void {
        this.events.onData(this, data);
    }

    protected onError(err: Error): void {
        this.events.onError(this, err);
    }

    protected onDisconnected(): void {
        this.selfDisconnect(
            GenericDeviceDisconnectReason.TRANSPORT_DISCONNECTED,
        );
    }

    public selfDisconnect(reason: DeviceDisconnectReason): void {
        this.events.onSelfDisconnection(this, reason);
    }

    private async disconnectLocked(
        reason: DeviceDisconnectReason,
    ): Promise<void> {
        if (
            this.state !== DeviceState.CONNECTED &&
            this.state !== DeviceState.SELF_CONNECTING
        ) {
            this.logger.info(
                `Tried to disconnect while device has state ${this.state}`,
            );
            return;
        }

        this.logger.info(`Disconnecting with reason ${reason}`);

        this.setState(DeviceState.DISCONNECTING);

        try {
            await this.disconnectImpl(reason);

            this.logger.info('Disconnected');
        } catch (err) {
            this.logger.error('Failed to disconnect', err);
        }

        this.setState(DeviceState.AVAILABLE);
    }

    public async disconnect(reason: DeviceDisconnectReason): Promise<void> {
        const release = await this.mutex.acquire();

        try {
            await this.disconnectLocked(reason);
        } finally {
            release();
        }
    }
}
