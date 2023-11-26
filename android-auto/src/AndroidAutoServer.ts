import { ServiceFactory } from './services/ServiceFactory';
import { IServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import { DeviceHandler, DeviceHandlerEvent } from './transport/DeviceHandler';
import { getLogger } from '@web-auto/logging';
import { Device } from './transport/Device';
import { AndroidAutoDevice, AndroidAutoDeviceEvent } from './AndroidAutoDevice';

export interface AndroidAutoServerConfig {
    serviceDiscovery: IServiceDiscoveryResponse;
    deviceNameWhitelist?: string[];
}

export class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private nameAndroidAutoMap = new Map<string, AndroidAutoDevice>();
    private started = false;

    public constructor(
        private options: AndroidAutoServerConfig,
        private serviceFactory: ServiceFactory,
        private deviceHandlers: DeviceHandler[],
    ) {
        this.onDeviceAvailable = this.onDeviceAvailable.bind(this);
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

    public async onDeviceAvailable(device: Device): Promise<void> {
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        if (
            this.options.deviceNameWhitelist !== undefined &&
            !this.options.deviceNameWhitelist.includes(device.name)
        ) {
            return;
        }

        await this.connectDevice(device);
    }

    public onDeviceUnavailable(device: Device): void {
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);
    }

    public async connectDevice(device: Device): Promise<void> {
        const androidAutoDevice = new AndroidAutoDevice(
            this.options,
            this.serviceFactory,
            device,
        );

        this.logger.info(`Connecting device ${device.name}`);
        try {
            await androidAutoDevice.connect();
        } catch (e) {
            this.logger.error(`Failed to connect to device ${device.name}`, {
                metadata: e,
            });
            return;
        }
        this.logger.info(`Connected device ${device.name}`);

        androidAutoDevice.emitter.on(
            AndroidAutoDeviceEvent.DISCONNECTED,
            () => {
                this.onAndroidAutoDisconnected(androidAutoDevice);
            },
        );

        this.nameAndroidAutoMap.set(device.name, androidAutoDevice);
    }

    private onAndroidAutoDisconnected(
        androidAutoDevice: AndroidAutoDevice,
    ): void {
        this.logger.info(`Disconnected ${androidAutoDevice.device.name}`);

        this.nameAndroidAutoMap.delete(androidAutoDevice.device.name);
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

        for (const androidAutoDevice of this.nameAndroidAutoMap.values()) {
            await androidAutoDevice.disconnect();
        }
        this.nameAndroidAutoMap.clear();

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
