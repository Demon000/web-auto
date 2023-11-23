import Bluez, { Adapter } from 'bluez';
import dbus from 'dbus-next';
import { OrgBluezDevice1Props } from 'bluez/dist/dbus';
import assert from 'node:assert';
import {
    Device,
    DeviceHandler,
    DeviceHandlerEvent,
} from '@web-auto/android-auto';
import { BluetoothDevice } from './BluetoothDevice';
import { AndroidAutoProfile } from './AndroidAutoProfile';
import { ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig';
import net from 'node:net';
import { getLogger } from '@web-auto/logging';

const AA_OBJECT_PATH = '/com/aa/aa';

export class ElectronBluetoothDeviceHandler extends DeviceHandler {
    private logger = getLogger(this.constructor.name);
    protected addressDeviceMap = new Map<string, Device>();
    private androidAutoProfile = new AndroidAutoProfile();
    private bus: dbus.MessageBus;
    private bluetooth: Bluez;
    private adapter?: Adapter;
    private tcpServer: net.Server;

    public constructor(private config: ElectronBluetoothDeviceHandlerConfig) {
        super();

        this.bus = dbus.systemBus({
            negotiateUnixFd: true,
        });

        this.bluetooth = new Bluez({
            bus: this.bus,
        });

        this.onDeviceAdded = this.onDeviceAdded.bind(this);

        assert(
            this.config.socketInfo.port !== undefined &&
                this.config.socketInfo.port != null,
        );

        this.tcpServer = net
            .createServer()
            .listen(
                this.config.socketInfo.port,
                this.config.socketInfo.ipAddress,
            );
    }

    private async onDeviceAdded(
        address: string,
        props: Partial<OrgBluezDevice1Props>,
    ): Promise<void> {
        assert(this.adapter !== undefined);

        const bluezDevice = await this.adapter.getDevice(address);
        let name: string | undefined;

        try {
            name = await bluezDevice.Name();
        } catch (err) {
            // do nothing
        }

        if (name === undefined) {
            name = address;
        }

        const needsPair = !props.Paired;
        const device = new BluetoothDevice(
            this.config,
            bluezDevice,
            this.androidAutoProfile,
            this.tcpServer,
            needsPair,
            address,
            name,
        );
        this.addressDeviceMap.set(address, device);

        this.emitter.emit(DeviceHandlerEvent.AVAILABLE, device);
    }

    private async onDeviceRemoved(address: string): Promise<void> {
        const device = this.addressDeviceMap.get(address);
        if (device === undefined) {
            return;
        }

        device.disconnect();

        this.emitter.emit(DeviceHandlerEvent.UNAVAILABLE, device);

        this.addressDeviceMap.delete(address);
    }

    public async waitForDevicesAsync(): Promise<void> {
        await this.bluetooth.init();

        await this.bluetooth.registerProfile(
            this.androidAutoProfile,
            AA_OBJECT_PATH,
        );

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

        const devices = await this.adapter.listDevices();
        for (const props of Object.values(devices)) {
            if (!props.Address) {
                continue;
            }

            this.onDeviceAdded(props.Address, props);
        }

        await this.adapter.StartDiscovery();

        this.adapter.on('DeviceAdded', this.onDeviceAdded);
        this.adapter.on('DeviceRemoved', this.onDeviceRemoved);
    }

    public waitForDevices(): void {
        this.waitForDevicesAsync();
    }

    public async stopWaitingForDevicesAsync(): Promise<void> {
        if (!this.adapter) {
            return;
        }

        this.adapter.off('DeviceAdded', this.onDeviceAdded);
        this.adapter.off('DeviceRemoved', this.onDeviceRemoved);

        await this.adapter.StopDiscovery();

        this.bus.disconnect();
    }

    public stopWaitingForDevices(): void {
        this.stopWaitingForDevicesAsync();
    }
}
