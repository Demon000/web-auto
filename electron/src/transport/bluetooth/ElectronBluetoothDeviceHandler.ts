import { Bluez, Adapter } from 'bluez';
import dbus from 'dbus-next';
import assert from 'node:assert';
import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { BluetoothDevice } from './BluetoothDevice.js';
import { AndroidAutoProfile } from './AndroidAutoProfile.js';
import { type ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig.js';
import net from 'node:net';
import { Duplex } from 'node:stream';

const AA_OBJECT_PATH = '/com/aa/aa';

export class ElectronBluetoothDeviceHandler extends DeviceHandler {
    protected addressDeviceMap = new Map<string, BluetoothDevice>();
    private androidAutoProfile: AndroidAutoProfile;
    private bus?: dbus.MessageBus;
    private bluetooth?: Bluez;
    private adapter?: Adapter;
    private tcpServer?: net.Server;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(events);

        this.onDeviceAdded = this.onDeviceAdded.bind(this);
        this.onDeviceRemoved = this.onDeviceRemoved.bind(this);
        this.onProfileConnected = this.onProfileConnected.bind(this);
        this.onProfileDisconnected = this.onProfileDisconnected.bind(this);

        this.androidAutoProfile = new AndroidAutoProfile({
            onConnected: this.onProfileConnected,
            onDisconnected: this.onProfileDisconnected,
        });
    }

    private async onDeviceAdded(address: string): Promise<void> {
        this.logger.info(`Bluetooth device added ${address}`);
        assert(this.adapter !== undefined);
        assert(this.tcpServer !== undefined);

        const bluezDevice = await this.adapter.getDevice(address);

        let name;
        try {
            name = await bluezDevice.Name();
        } catch (err) {
            return;
        }

        const device = new BluetoothDevice(
            this.config,
            bluezDevice,
            this.tcpServer,
            name,
            this.getDeviceEvents(),
        );
        this.addressDeviceMap.set(address, device);

        try {
            await this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', {
                metadata: err,
            });
        }
    }

    private async onDeviceRemoved(address: string): Promise<void> {
        this.logger.debug(`Bluetooth device removed ${address}`);
        const device = this.addressDeviceMap.get(address);
        if (device === undefined) {
            return;
        }

        try {
            await this.events.onDeviceUnavailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device unavailable event', {
                metadata: err,
            });
        }

        this.addressDeviceMap.delete(address);
    }

    private async onProfileConnected(
        address: string,
        socket: Duplex,
    ): Promise<void> {
        this.logger.info(
            `Received bluetooth profile connection from device ${address}`,
        );
        const device = this.addressDeviceMap.get(address);
        if (device === undefined) {
            this.logger.error(
                `Received connection from unknown device ${address}`,
            );
            return;
        }

        await device.onBluetoothProfileConnected(socket);
    }

    private async onProfileDisconnected(address: string): Promise<void> {
        this.logger.info(
            `Received bluetooth profile disconnection from device ${address}`,
        );
        const device = this.addressDeviceMap.get(address);
        if (device === undefined) {
            this.logger.error(
                `Received disconnection from unknown device ${address}`,
            );
            return;
        }

        await device.onBluetoothProfileDisconnected();
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
            this.logger.error('Failed to get adapter', {
                metadata: err,
            });
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
            if (!props.Address) {
                continue;
            }

            await this.onDeviceAdded(props.Address);
        }
        this.logger.info('Finished processing paired devices');

        this.adapter.on('DeviceAdded', this.onDeviceAdded);
        this.adapter.on('DeviceRemoved', this.onDeviceRemoved);
    }

    public async stopWaitingForDevices(): Promise<void> {
        if (this.adapter !== undefined) {
            this.logger.info('Stopping new device discovery');
            this.adapter.off('DeviceAdded', this.onDeviceAdded);
            this.adapter.off('DeviceRemoved', this.onDeviceRemoved);

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
