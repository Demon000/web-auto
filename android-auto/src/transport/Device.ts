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
    onSelfDisconnection: (device: Device, reason?: string) => void;
    onData: (device: Device, buffer: Uint8Array) => void;
    onError: (device: Device, err: Error) => void;
}

export enum DeviceDisconnectReason {
    USER = 'user-requested',
    START_FAILED = 'start-failed',
    DO_START_FAILED = 'do-start-failed',
}

export enum DeviceProbeResult {
    SUPPORTED,
    NEEDS_RESET,
    UNSUPPORTED,
}

export abstract class Device {
    public state = DeviceState.AVAILABLE;
    public name: string;
    protected logger: LoggerWrapper;
    protected mutex = new Mutex();
    protected onDataBound: (data: Uint8Array) => void;
    protected onErrorBound: (err: Error) => void;
    protected onDisconnectedBound: () => void;

    public constructor(
        public prefix: string,
        public realName: string,
        protected events: DeviceEvents,
    ) {
        this.name = `${prefix}: ${realName}`;

        this.logger = getLogger(`${this.constructor.name}@${this.realName}`);

        this.onDataBound = this.onData.bind(this);
        this.onErrorBound = this.onError.bind(this);
        this.onDisconnectedBound = this.onDisconnected.bind(this);
    }

    public async reset(): Promise<void> {}
    protected abstract connectImpl(): Promise<void>;
    protected abstract disconnectImpl(reason: string): Promise<void>;
    public async rejectSelfConnection(): Promise<void> {}
    public abstract send(buffer: Uint8Array): void;
    // eslint-disable-next-line @typescript-eslint/require-await
    public async probe(_existing?: true): Promise<DeviceProbeResult> {
        return DeviceProbeResult.SUPPORTED;
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
            await this.connectImpl();
        } catch (err) {
            this.logger.error('Failed to connect', err);
            this.setState(DeviceState.AVAILABLE);
            release();
            throw err;
        }

        this.setState(DeviceState.CONNECTED);
        release();
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
        this.selfDisconnect();
    }

    public selfDisconnect(reason?: string): void {
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

        this.logger.info('Disconnecting');
        try {
            await this.disconnectImpl(reason);

            this.logger.info('Disconnected');
        } catch (err) {
            this.logger.error('Failed to disconnect', err);
        }

        this.setState(DeviceState.AVAILABLE);

        release();
    }
}
