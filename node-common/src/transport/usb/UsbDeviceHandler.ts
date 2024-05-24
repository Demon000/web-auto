import {
    Device,
    DeviceHandler,
    DeviceIndex,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { UsbDevice } from './UsbDevice.js';
import { Device as UsbDeviceImpl, usb } from 'usb';

export interface UsbDeviceHandlerConfig {}

export class UsbDeviceHandler extends DeviceHandler<UsbDeviceImpl> {
    private implUniqueIdMap = new Map<UsbDeviceImpl, string>();
    private removeDeviceImplBound: (data: UsbDeviceImpl) => void;

    public constructor(
        protected config: UsbDeviceHandlerConfig,
        ignoredDevices: string[] | undefined,
        index: DeviceIndex,
        events: DeviceHandlerEvents,
    ) {
        super(
            {
                ignoredDevices,
            },
            index,
            events,
        );

        this.removeDeviceImplBound = this.removeDeviceImpl.bind(this);
    }

    protected override createDevice(
        data: UsbDeviceImpl,
    ): Promise<Device | undefined> {
        return UsbDevice.create(data, this.getDeviceEvents());
    }

    protected override addDeviceHook(
        data: UsbDeviceImpl,
        device: Device,
    ): void {
        this.implUniqueIdMap.set(data, device.uniqueId);
    }

    protected override removeDeviceHook(device: Device): void {
        for (const [data, uniqueId] of this.implUniqueIdMap.entries()) {
            if (uniqueId === device.uniqueId) {
                this.implUniqueIdMap.delete(data);
            }
        }
    }

    private removeDeviceImpl(data: UsbDeviceImpl): void {
        const uniqueId = this.implUniqueIdMap.get(data);
        if (uniqueId === undefined) {
            return;
        }

        this.removeDevice(uniqueId);
    }

    public async waitForDevices(): Promise<void> {
        this.logger.info('Starting new device connection handler');

        this.logger.info('Processing already connected devices');

        const aoapDevices = usb.getDeviceList();
        for (const device of aoapDevices) {
            await this.addDeviceAsync(device, true);
        }

        this.logger.info('Finshed processing already connected devices');

        usb.on('attach', this.addDeviceBound);
        usb.on('detach', this.removeDeviceImplBound);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        usb.off('attach', this.addDeviceBound);
        usb.off('detach', this.removeDeviceImplBound);

        this.logger.info('Stopped new device connection handler');
    }
}
