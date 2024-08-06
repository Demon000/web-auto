import assert from 'node:assert';
import net from 'node:net';

import {
    Device,
    DeviceHandler,
    type DeviceHandlerConfig,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import type {
    INetworkInfo,
    ISocketInfoRequest,
} from '@web-auto/android-auto-proto/bluetooth_interfaces.js';
import { getLogger } from '@web-auto/logging';
import { Adapter, Bluez } from 'bluez';
import dbus from 'dbus-next';

import { AndroidAutoProfile } from './AndroidAutoProfile.js';
import { BluetoothDevice } from './BluetoothDevice.js';

const AA_OBJECT_PATH = '/com/aa/aa';

export interface BluetoothDeviceHandlerConfig extends DeviceHandlerConfig {
    profileConnectionTimeoutMs: number;
    wifiConnectionTimeoutMs: number;
    tcpConnectionTimeoutMs: number;
    networkInfo: INetworkInfo;
    socketInfo: ISocketInfoRequest;
}

export class BluetoothDeviceHandler extends DeviceHandler<string> {
    private androidAutoProfile: AndroidAutoProfile;
    public constructor(
        private tcpServer: net.Server,
        private bus: dbus.MessageBus,
        private bluetooth: Bluez,
        private adapter: Adapter,
        protected override config: BluetoothDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(config, events);

        this.androidAutoProfile = new AndroidAutoProfile();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public static async create(
        config: BluetoothDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ): Promise<BluetoothDeviceHandler> {
        const logger = getLogger(BluetoothDeviceHandler.name);

        logger.info('Creating TCP server');
        assert(
            config.socketInfo.port !== undefined &&
                config.socketInfo.port != null,
        );

        const tcpServer = net
            .createServer({
                noDelay: true,
            })
            .listen(config.socketInfo.port, config.socketInfo.ipAddress);
        logger.info('Created TCP server');

        logger.info('Connecting to DBus');
        const bus = dbus.systemBus({
            negotiateUnixFd: true,
        });
        logger.info('Connected to DBus');

        const bluetooth = new Bluez({
            bus,
        });

        logger.info('Initializing Bluetooth');
        await bluetooth.init();
        logger.info('Initialized Bluetooth');

        logger.info('Powering adapter on');
        let adapter;
        try {
            adapter = await bluetooth.getAdapter();
        } catch (err) {
            logger.error('Failed to get adapter', err);
            throw err;
        }

        await adapter.Powered(true);
        await adapter.Discoverable(true);
        await adapter.Pairable(true);

        return new BluetoothDeviceHandler(
            tcpServer,
            bus,
            bluetooth,
            adapter,
            config,
            events,
        );
    }

    public override destroy(): void {
        this.logger.info('Disconnecting from DBus');
        this.bus.disconnect();
        this.logger.info('Disconnected from DBus');
    }

    protected override async createDevice(
        data: string,
    ): Promise<Device | undefined> {
        const bluezDevice = await this.adapter.getDevice(data);
        const device = await BluetoothDevice.create(
            this.config,
            bluezDevice,
            data,
            this.tcpServer,
            this.getDeviceEvents(),
        );

        return device;
    }

    protected override addDeviceHook(data: string, device: Device): void {
        assert(device instanceof BluetoothDevice);
        this.androidAutoProfile.addHandler(data, device.profileHandler);
    }

    protected override removeDeviceHook(device: Device): void {
        assert(device instanceof BluetoothDevice);
        this.androidAutoProfile.removeHandler(
            device.uniqueId,
            device.profileHandler,
        );
    }

    public async waitForDevices(): Promise<void> {
        this.logger.info('Registering Android Auto Bluetooth profile');
        await this.bluetooth.registerProfile(
            this.androidAutoProfile,
            AA_OBJECT_PATH,
        );
        this.logger.info('Registered Android Auto Bluetooth profile');

        this.logger.info('Starting new device discovery');
        await this.adapter.StartDiscovery();

        this.logger.info('Processing paired devices');
        const devices = await this.adapter.listDevices();
        for (const props of Object.values(devices)) {
            if (props.Address === undefined) {
                continue;
            }

            await this.addDeviceAsync(props.Address);
        }
        this.logger.info('Finished processing paired devices');

        this.adapter.on('DeviceAdded', this.addDeviceBound);
        this.adapter.on('DeviceRemoved', this.removeDeviceBound);
    }

    public override async stopWaitingForDevices(): Promise<void> {
        this.logger.info('Stopping new device discovery');
        this.adapter.off('DeviceAdded', this.addDeviceBound);
        this.adapter.off('DeviceRemoved', this.removeDeviceBound);

        await this.adapter.StopDiscovery();

        this.logger.info('Stopped new device discovery');

        this.logger.info('Unregistering Android Auto Bluetooth profile');
        await this.bluetooth.unregisterProfile(AA_OBJECT_PATH);
        this.logger.info('Unregistered Android Auto Bluetooth profile');
    }
}
