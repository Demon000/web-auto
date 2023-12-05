import {
    Device,
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { WebUSB } from 'usb';
import { UsbDevice, usbDeviceName as name } from './UsbDevice.js';
import { UsbAoapConnector } from './UsbAoapConnector.js';

const GOOGLE_VENDOR_ID = 0x18d1;
const GOOGLE_AOAP_WITHOUT_ADB_ID = 0x2d00;
const GOOGLE_AOAP_WITH_ADB_ID = 0x2d01;

type IgnoredDevice = [number, number];

export interface ElectronUsbDeviceHandlerConfig {
    ignoredDevices?: IgnoredDevice[];
    handleAlreadyConnectedDevices?: boolean;
}

export class ElectronUsbDeviceHandler extends DeviceHandler {
    protected usbDeviceMap = new Map<USBDevice, Device>();
    private usb;
    private aoapConnector: UsbAoapConnector;

    public constructor(
        private config: ElectronUsbDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(events);

        this.handleConnectedDevice = this.handleConnectedDevice.bind(this);
        this.handleDisconnectedDevice =
            this.handleDisconnectedDevice.bind(this);
        this.usb = new WebUSB({
            allowAllDevices: true,
        });
        this.aoapConnector = new UsbAoapConnector();
    }

    private isDeviceAoap(device: USBDevice): boolean {
        return (
            device.vendorId === GOOGLE_VENDOR_ID &&
            (device.productId === GOOGLE_AOAP_WITH_ADB_ID ||
                device.productId === GOOGLE_AOAP_WITHOUT_ADB_ID)
        );
    }

    private async handleConnectedAoapDevice(
        usbDevice: USBDevice,
    ): Promise<void> {
        this.logger.debug(`Found device ${name(usbDevice)} with AA`);

        const device = new UsbDevice(usbDevice, this.getDeviceEvents());
        this.usbDeviceMap.set(usbDevice, device);

        try {
            await this.events.onDeviceAvailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device available event', err);
        }
    }

    private async connectUnknownDevice(device: USBDevice): Promise<void> {
        if (
            this.config !== undefined &&
            this.config.ignoredDevices !== undefined
        ) {
            for (const ignoredDevice of this.config.ignoredDevices) {
                if (
                    ignoredDevice[0] === device.vendorId &&
                    ignoredDevice[1] === device.productId
                ) {
                    this.logger.debug(`Ignoring device ${name(device)}`);
                    return;
                }
            }
        }

        await this.aoapConnector.connect(device);
    }

    private async handleConnectedDevice(
        event: USBConnectionEvent,
    ): Promise<void> {
        const device = event.device;
        if (this.isDeviceAoap(device)) {
            await this.handleConnectedAoapDevice(device);
        } else {
            await this.connectUnknownDevice(device);
        }
    }

    private async handleAlreadyConnectedAoapDevice(
        device: USBDevice,
    ): Promise<void> {
        try {
            await device.open();
            await device.reset();
            await device.close();
        } catch (err) {
            this.logger.error(
                `Failed to reset already connected device ${name(device)}`,
                err,
            );
            return;
        }
    }

    private async handleDisconnectedDevice(
        event: USBConnectionEvent,
    ): Promise<void> {
        const usbDevice = event.device;
        const device = this.usbDeviceMap.get(usbDevice);
        if (device === undefined) {
            return;
        }

        try {
            await this.events.onDeviceUnavailable(device);
        } catch (err) {
            this.logger.error('Failed to emit device unavailable event', err);
        }

        this.usbDeviceMap.delete(usbDevice);
    }

    public async waitForDevices(): Promise<void> {
        this.logger.info('Starting new device connection handler');

        this.usb.addEventListener('connect', this.handleConnectedDevice);
        this.usb.addEventListener('disconnect', this.handleDisconnectedDevice);

        this.logger.info('Processing already connected devices');

        const aoapDevices = await this.usb.getDevices();
        for (const device of aoapDevices) {
            if (this.isDeviceAoap(device)) {
                if (
                    this.config.handleAlreadyConnectedDevices !== undefined &&
                    this.config.handleAlreadyConnectedDevices
                ) {
                    await this.handleAlreadyConnectedAoapDevice(device);
                } else {
                    this.logger.info(
                        `Ignoring ${name(device)} already in AOAP mode`,
                    );
                }
            } else {
                await this.connectUnknownDevice(device);
            }
        }

        this.logger.info('Finshed processing already connected devices');
    }

    public async stopWaitingForDevices(): Promise<void> {
        this.usb.removeEventListener('connect', this.handleConnectedDevice);
        this.usb.removeEventListener(
            'disconnect',
            this.handleDisconnectedDevice,
        );

        this.logger.info('Stopped new device connection handler');
    }
}
