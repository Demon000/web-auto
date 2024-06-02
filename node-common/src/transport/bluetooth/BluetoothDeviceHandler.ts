import { Bluez, Adapter } from 'bluez';
import dbus from 'dbus-next';
import assert from 'node:assert';
import {
    Device,
    DeviceHandler,
    type DeviceHandlerConfig,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { BluetoothDevice } from './BluetoothDevice.js';
import { AndroidAutoProfile } from './AndroidAutoProfile.js';
import net from 'node:net';
import type {
    INetworkInfo,
    ISocketInfoRequest,
} from '@web-auto/android-auto-proto/bluetooth_interfaces.js';

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
    private bus?: dbus.MessageBus;
    private bluetooth?: Bluez;
    private adapter?: Adapter;
    private tcpServer?: net.Server;

    public constructor(
        protected override config: BluetoothDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(config, events);

        this.androidAutoProfile = new AndroidAutoProfile();
    }

    protected override async createDevice(
        data: string,
    ): Promise<Device | undefined> {
        assert(this.adapter !== undefined);
        assert(this.tcpServer !== undefined);

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
        this.logger.info('Creating TCP server');
        assert(
            this.config.socketInfo.port !== undefined &&
                this.config.socketInfo.port != null,
        );

        this.tcpServer = net
            .createServer({
                noDelay: true,
            })
            .listen(
                this.config.socketInfo.port,
                this.config.socketInfo.ipAddress,
            );
        this.logger.info('Created TCP server');

        this.logger.info('Connecting to DBus');
        this.bus = dbus.systemBus({
            negotiateUnixFd: true,
        });
        this.logger.info('Connected to DBus');

        this.bluetooth = new Bluez({
            bus: this.bus,
        });

        this.logger.info('Initializing Bluetooth');
        await this.bluetooth.init();
        this.logger.info('Initialized Bluetooth');

        this.logger.info('Registering Android Auto Bluetooth profile');
        await this.bluetooth.registerProfile(
            this.androidAutoProfile,
            AA_OBJECT_PATH,
        );
        this.logger.info('Registered Android Auto Bluetooth profile');

        this.logger.info('Powering adapter on');
        try {
            this.adapter = await this.bluetooth.getAdapter();
        } catch (err) {
            this.logger.error('Failed to get adapter', err);
            return;
        }

        await this.adapter.Powered(true);
        await this.adapter.Discoverable(true);
        await this.adapter.Pairable(true);

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
        if (this.adapter !== undefined) {
            this.logger.info('Stopping new device discovery');
            this.adapter.off('DeviceAdded', this.addDeviceBound);
            this.adapter.off('DeviceRemoved', this.removeDeviceBound);

            await this.adapter.StopDiscovery();

            this.logger.info('Stopped new device discovery');
        }

        if (this.bluetooth !== undefined) {
            this.logger.info('Unregistering Android Auto Bluetooth profile');
            await this.bluetooth.unregisterProfile(AA_OBJECT_PATH);
            this.logger.info('Unregistered Android Auto Bluetooth profile');
        }

        if (this.bus !== undefined) {
            this.logger.info('Disconnecting from DBus');
            this.bus.disconnect();
            this.logger.info('Disconnected from DBus');
        }
    }
}
