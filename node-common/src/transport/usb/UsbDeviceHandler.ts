import {
    Device,
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { UsbDevice } from './UsbDevice.js';
import { Device as UsbDeviceImpl, usb } from 'usb';

export interface UsbDeviceHandlerConfig {
    autoConnect?: boolean;
}

export class UsbDeviceHandler extends DeviceHandler<UsbDeviceImpl> {
    public constructor(
        protected config: UsbDeviceHandlerConfig,
        ignoredDevices: string[] | undefined,
        events: DeviceHandlerEvents,
    ) {
        super(
            {
                ignoredDevices,
                selfConnectOnAvailable: config.autoConnect === true,
            },
            events,
        );
    }

    protected override createDevice(
        data: UsbDeviceImpl,
    ): Promise<Device | undefined> {
        return UsbDevice.create(data, this.getDeviceEvents());
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
        usb.on('detach', this.removeDeviceBound);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        usb.off('attach', this.addDeviceBound);
        usb.off('detach', this.removeDeviceBound);

        this.logger.info('Stopped new device connection handler');
    }
}
