import {
    Device,
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { UsbDevice } from './UsbDevice.js';
import { UsbAoapConnector } from './UsbAoapConnector.js';
import { UsbDeviceWrapper, UsbCallbackWrapper } from './UsbDeviceWrapper.js';

const GOOGLE_VENDOR_ID = 0x18d1;
const GOOGLE_AOAP_WITHOUT_ADB_ID = 0x2d00;
const GOOGLE_AOAP_WITH_ADB_ID = 0x2d01;

type IgnoredDevice = [number, number];

export interface UsbDeviceHandlerConfig {
    ignoredDevices?: IgnoredDevice[];
    handleAlreadyConnectedDevices?: boolean;
}

export class UsbDeviceHandler extends DeviceHandler {
    protected usbDeviceMap = new Map<UsbDeviceWrapper, Device>();
    private usb;
    private aoapConnector: UsbAoapConnector;

    public constructor(
        private config: UsbDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(events);

        this.usb = new UsbCallbackWrapper(
            this.handleConnectedDevice.bind(this),
            this.handleDisconnectedDevice.bind(this),
        );
        this.aoapConnector = new UsbAoapConnector();
    }

    private isDeviceAoap(device: UsbDeviceWrapper): boolean {
        return (
            device.vendorId === GOOGLE_VENDOR_ID &&
            (device.productId === GOOGLE_AOAP_WITH_ADB_ID ||
                device.productId === GOOGLE_AOAP_WITHOUT_ADB_ID)
        );
    }

    private handleConnectedAoapDevice(usbDevice: UsbDeviceWrapper): void {
        this.logger.info(`Found device ${usbDevice.name} with AA`);

        const device = new UsbDevice(usbDevice, this.getDeviceEvents());
        this.usbDeviceMap.set(usbDevice, device);

        try {
            this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', err);
        }
    }

    private async connectUnknownDevice(
        device: UsbDeviceWrapper,
    ): Promise<void> {
        if (
            this.config !== undefined &&
            this.config.ignoredDevices !== undefined
        ) {
            for (const ignoredDevice of this.config.ignoredDevices) {
                if (
                    ignoredDevice[0] === device.vendorId &&
                    ignoredDevice[1] === device.productId
                ) {
                    this.logger.info(`Ignoring device ${device.name}`);
                    return;
                }
            }
        }

        await this.aoapConnector.connect(device);
    }

    private handleConnectedDevice(device: UsbDeviceWrapper): void {
        if (this.isDeviceAoap(device)) {
            this.handleConnectedAoapDevice(device);
        } else {
            this.connectUnknownDevice(device)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to handle unknown device', err);
                });
        }
    }

    private async handleAlreadyConnectedAoapDevice(
        device: UsbDeviceWrapper,
    ): Promise<void> {
        try {
            await device.open();
            await device.reset();
            await device.close();
        } catch (err) {
            this.logger.error(
                `Failed to reset already connected device ${device.name}`,
                err,
            );
            return;
        }
    }

    private handleDisconnectedDevice(usbDevice: UsbDeviceWrapper): void {
        const device = this.usbDeviceMap.get(usbDevice);
        if (device === undefined) {
            return;
        }

        try {
            this.events.onDeviceUnavailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device unavailable event', err);
        }

        this.usbDeviceMap.delete(usbDevice);
    }

    public async waitForDevices(): Promise<void> {
        this.logger.info('Starting new device connection handler');

        this.usb.register();

        this.logger.info('Processing already connected devices');

        const aoapDevices = await this.usb.getDevices();
        for (const device of aoapDevices) {
            this.logger.info(
                `Processing already connected device ${device.name}`,
            );

            if (this.isDeviceAoap(device)) {
                if (
                    this.config.handleAlreadyConnectedDevices !== undefined &&
                    this.config.handleAlreadyConnectedDevices
                ) {
                    await this.handleAlreadyConnectedAoapDevice(device);
                } else {
                    this.logger.info(
                        `Ignoring ${device.name} already in AOAP mode`,
                    );
                }
            } else {
                await this.connectUnknownDevice(device);
            }
        }

        this.logger.info('Finshed processing already connected devices');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        this.usb.unregister();

        this.logger.info('Stopped new device connection handler');
    }
}
