import {
    AndroidAutoServer,
    Device,
    DeviceConnectReason,
    GenericDeviceDisconnectReason,
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
};

export type AndroidAutoServerClient = {
    devices: (devices: IDevice[]) => void;
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

    public async connectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.connectDeviceAsync(device, DeviceConnectReason.USER);
    }

    public async disconnectDeviceName(name: string): Promise<void> {
        const device = this.getDeviceByName(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.disconnectDeviceAsync(
            device,
            GenericDeviceDisconnectReason.USER,
        );
    }

    protected onDevicesUpdatedCallback(devices: Device[]): void {
        const ipcDevices = this.devicesFromImpl(devices);
        this.ipcHandler.devices(ipcDevices);
    }
}
