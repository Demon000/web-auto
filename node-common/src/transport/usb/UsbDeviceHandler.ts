import {
    Device,
    DeviceHandler,
    type DeviceHandlerConfig,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { Device as UsbDeviceImpl, usb } from 'usb';

import { UsbDevice } from './UsbDevice.js';
import { toHex } from '../../utils.js';

export interface UsbDeviceHandlerConfig extends DeviceHandlerConfig {}

export class UsbDeviceHandler extends DeviceHandler<UsbDeviceImpl> {
    private implUniqueIdMap = new Map<UsbDeviceImpl, string>();
    private removeDeviceImplBound: (data: UsbDeviceImpl) => void;

    public constructor(
        protected override config: UsbDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(config, events);

        this.removeDeviceImplBound = this.removeDeviceImpl.bind(this);
    }

    protected override dataToString(data: UsbDeviceImpl): string {
        const toHexString = (num: number) => toHex(num, 4).toLowerCase();
        const vendorId = toHexString(data.deviceDescriptor.idVendor);
        const productId = toHexString(data.deviceDescriptor.idProduct);
        return `${vendorId}:${productId}`;
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

        usb.on('attach', this.addDeviceBound);
        usb.on('detach', this.removeDeviceImplBound);

        const aoapDevices = usb.getDeviceList();
        for (const device of aoapDevices) {
            await this.addDeviceAsync(device, true);
        }

        this.logger.info('Finshed processing already connected devices');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        usb.off('attach', this.addDeviceBound);
        usb.off('detach', this.removeDeviceImplBound);

        this.logger.info('Stopped new device connection handler');
    }
}
