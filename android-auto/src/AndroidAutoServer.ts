import { ServiceFactory } from './services/ServiceFactory';
import { IServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import { DeviceHandler, DeviceHandlerEvent } from './transport/DeviceHandler';
import { getLogger } from '@web-auto/logging';
import { Device, DeviceEvent } from './transport/Device';
import { AndroidAutoDevice } from './AndroidAutoDevice';
import EventEmitter from 'eventemitter3';

export interface AndroidAutoServerConfig {
    serviceDiscovery: IServiceDiscoveryResponse;
    deviceNameWhitelist?: string[];
}

export enum AndroidAutoserverEvent {
    DEVICES_UPDATED = 'devices-updated',
}

export interface AndroidAutoServerEvents {
    [AndroidAutoserverEvent.DEVICES_UPDATED]: (device: Device[]) => void;
}

export class AndroidAutoServer {
    public emitter = new EventEmitter<AndroidAutoServerEvents>();
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private activeAndroidAutoDevice?: AndroidAutoDevice;
    private started = false;

    public constructor(
        private options: AndroidAutoServerConfig,
        private serviceFactory: ServiceFactory,
        private deviceHandlers: DeviceHandler[],
    ) {
        this.onDeviceAvailable = this.onDeviceAvailable.bind(this);
        this.onDeviceSelfConnect = this.onDeviceSelfConnect.bind(this);
        this.onDeviceStateUpdated = this.onDeviceStateUpdated.bind(this);
        this.onDeviceUnavailable = this.onDeviceUnavailable.bind(this);
        this.onAndroidAutoDisconnected =
            this.onAndroidAutoDisconnected.bind(this);

        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.emitter.on(
                DeviceHandlerEvent.AVAILABLE,
                this.onDeviceAvailable,
            );
            deviceHandler.emitter.on(
                DeviceHandlerEvent.UNAVAILABLE,
                this.onDeviceUnavailable,
            );
        }
    }

    private emitDevicesUpdated(): void {
        const devices = Array.from(this.nameDeviceMap.values());
        this.emitter.emit(AndroidAutoserverEvent.DEVICES_UPDATED, devices);
    }

    private async onDeviceSelfConnect(device: Device): Promise<void> {
        if (this.activeAndroidAutoDevice !== undefined) {
            return;
        }

        await this.connectDevice(device);
    }

    private onDeviceAvailable(device: Device): void {
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        this.emitDevicesUpdated();

        device.emitter.on(DeviceEvent.STATE_UPDATED, this.onDeviceStateUpdated);
        device.emitter.on(
            DeviceEvent.SELF_CONNECT_REQUESTED,
            this.onDeviceSelfConnect,
        );
    }

    private onDeviceStateUpdated(_device: Device): void {
        this.emitDevicesUpdated();
    }

    private onDeviceUnavailable(device: Device): void {
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);

        device.emitter.off(
            DeviceEvent.SELF_CONNECT_REQUESTED,
            this.onDeviceSelfConnect,
        );
        device.emitter.off(
            DeviceEvent.STATE_UPDATED,
            this.onDeviceStateUpdated,
        );

        this.emitDevicesUpdated();
    }

    private async connectDevice(device: Device): Promise<void> {
        if (
            this.options.deviceNameWhitelist !== undefined &&
            !this.options.deviceNameWhitelist.includes(device.name)
        ) {
            throw new Error(`Device ${device.name} is not whitelisted`);
        }

        if (this.activeAndroidAutoDevice !== undefined) {
            return;
        }

        const androidAutoDevice = new AndroidAutoDevice(
            this.options,
            this.serviceFactory,
            device,
            {
                onDisconnected: this.onAndroidAutoDisconnected,
            },
        );

        this.logger.info(`Connecting device ${device.name}`);
        this.activeAndroidAutoDevice = androidAutoDevice;
        try {
            await androidAutoDevice.connect();
        } catch (e) {
            this.activeAndroidAutoDevice = undefined;
            this.logger.error(`Failed to connect to device ${device.name}`, {
                metadata: e,
            });
            return;
        }
        this.logger.info(`Connected device ${device.name}`);
    }

    private async disconnectDevice(device: Device): Promise<void> {
        if (
            this.activeAndroidAutoDevice === undefined ||
            this.activeAndroidAutoDevice.device !== device
        ) {
            throw new Error(
                `Device ${device.name} does not have a ` +
                    'valid android auto session',
            );
        }

        await this.activeAndroidAutoDevice.disconnect();
        await this.onAndroidAutoDisconnected(this.activeAndroidAutoDevice);
    }

    public async connectDeviceName(name: string): Promise<void> {
        const device = this.nameDeviceMap.get(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.connectDevice(device);
    }

    public async disconnectDeviceName(name: string): Promise<void> {
        const device = this.nameDeviceMap.get(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.disconnectDevice(device);
    }

    private async onAndroidAutoDisconnected(
        androidAutoDevice: AndroidAutoDevice,
    ): Promise<void> {
        this.logger.info(`Disconnected ${androidAutoDevice.device.name}`);
        this.activeAndroidAutoDevice = undefined;
    }

    public async start(): Promise<void> {
        if (this.started) {
            return;
        }

        this.logger.info('Server starting');

        for (const deviceHandler of this.deviceHandlers) {
            try {
                await deviceHandler.waitForDevices();
            } catch (err) {
                this.logger.error('Failed to start waiting for devices', {
                    metadata: err,
                });
            }
        }

        this.logger.info('Server started');

        this.started = true;
    }

    public async stop(): Promise<void> {
        if (!this.started) {
            return;
        }

        this.logger.info('Server stopping');

        this.started = false;

        if (this.activeAndroidAutoDevice !== undefined) {
            await this.activeAndroidAutoDevice.disconnect();
        }

        for (const deviceHandler of this.deviceHandlers) {
            try {
                await deviceHandler.stopWaitingForDevices();
            } catch (err) {
                this.logger.error('Failed to stop waiting for devices', {
                    metadata: err,
                });
            }
        }

        this.logger.info('Server stopped');
    }
}
