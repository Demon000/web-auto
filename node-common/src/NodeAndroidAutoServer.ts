import {
    AndroidAutoServer,
    Device,
    type AndroidAutoServerBuilder,
} from '@web-auto/android-auto';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export interface IDevice {
    prefix: string;
    name: string;
    realName: string;
    state: string;
}

export type AndroidAutoServerService = {
    connectDeviceName(name: string): Promise<void>;
    disconnectDeviceName(name: string): Promise<void>;
    getDevices(): Promise<IDevice[]>;
    getConnectedDevice(): Promise<IDevice | undefined>;
};

export type AndroidAutoServerClient = {
    devices: (devices: IDevice[]) => void;
    deviceConnected: (device: IDevice) => void;
    deviceDisconnected: () => void;
};

export class NodeAndroidAutoServer extends AndroidAutoServer {
    public constructor(
        builder: AndroidAutoServerBuilder,
        protected ipcHandler: IpcServiceHandler<
            AndroidAutoServerService,
            AndroidAutoServerClient
        >,
    ) {
        super(builder);

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
