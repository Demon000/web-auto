import {
    AndroidAutoServer,
    Device,
    type AndroidAutoServerBuilder,
} from '@web-auto/android-auto';
import {
    AndroidAutoIpcNames,
    type AndroidAutoServerClient,
    type AndroidAutoServerService,
    type IDevice,
} from '@web-auto/android-auto-ipc';
import type {
    IpcServiceRegistry,
    IpcServiceHandler,
} from '@web-auto/common-ipc/main.js';

export class NodeAndroidAutoServer extends AndroidAutoServer {
    private ipcHandler: IpcServiceHandler<
        AndroidAutoServerService,
        AndroidAutoServerClient
    >;

    public constructor(
        builder: AndroidAutoServerBuilder,
        protected ipcRegistry: IpcServiceRegistry,
    ) {
        super(builder);

        this.ipcHandler = this.ipcRegistry.registerIpcService<
            AndroidAutoServerService,
            AndroidAutoServerClient
        >(AndroidAutoIpcNames.SERVER);

        this.ipcHandler.on(
            'connectDeviceName',
            this.connectDeviceName.bind(this),
        );
        this.ipcHandler.on(
            'disconnectDeviceName',
            this.disconnectDeviceName.bind(this),
        );

        this.ipcHandler.on('getDevices', this.getDevicesObjects.bind(this));
        this.ipcHandler.on(
            'getConnectedDevice',
            this.getConnectedDeviceObject.bind(this),
        );
    }

    protected deviceFromImpl(device: Device): IDevice {
        return {
            name: device.name,
            prefix: device.prefix,
            realName: device.realName,
            state: device.state,
        };
    }

    protected devicesFromImpl(devices: Device[]): IDevice[] {
        const ipcDevices: IDevice[] = [];
        for (const device of devices) {
            ipcDevices.push(this.deviceFromImpl(device));
        }

        return ipcDevices;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getDevicesObjects(): Promise<IDevice[]> {
        const devices = this.getDevices();
        return this.devicesFromImpl(devices);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getConnectedDeviceObject(): Promise<IDevice | undefined> {
        const device = this.getConnectedDevice();
        if (device === undefined) {
            return undefined;
        }

        return this.deviceFromImpl(device);
    }

    public async connectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.connectDeviceAsync(device);
    }

    public async disconnectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.disconnectDeviceAsync(device);
    }

    protected onDevicesUpdatedCallback(devices: Device[]): void {
        const ipcDevices = this.devicesFromImpl(devices);
        this.ipcHandler.devices(ipcDevices);
    }

    protected onDeviceDisconnectedCallback(): void {
        this.ipcHandler.deviceDisconnected();
    }
    protected onDeviceConnectedCallback(device: Device): void {
        this.ipcHandler.deviceConnected(this.deviceFromImpl(device));
    }
}
