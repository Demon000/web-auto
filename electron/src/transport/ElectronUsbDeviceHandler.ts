import {
    Device,
    DeviceDisconnectReason,
    DeviceHandler,
    DeviceHandlerEvent,
} from '@web-auto/android-auto';
import { WebUSB } from 'usb';
import { getLogger } from '@web-auto/logging';
import { UsbDevice, usbDeviceName as name } from './UsbDevice';
import { UsbAoapConnector } from './UsbAoapConnector';

const GOOGLE_VENDOR_ID = 0x18d1;
const GOOGLE_AOAP_WITHOUT_ADB_ID = 0x2d00;
const GOOGLE_AOAP_WITH_ADB_ID = 0x2d01;

type IgnoredDevice = [number, number];

export interface ElectronUsbDeviceHandlerConfig {
    ignoredDevices?: IgnoredDevice[];
}

export class ElectronUsbDeviceHandler extends DeviceHandler {
    protected usbDeviceMap = new Map<USBDevice, Device>();
    private logger = getLogger(this.constructor.name);
    private usb;
    private aoapConnector: UsbAoapConnector;

    public constructor(private config?: ElectronUsbDeviceHandlerConfig) {
        super();

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

        const device = new UsbDevice(usbDevice);
        this.usbDeviceMap.set(usbDevice, device);

        this.emitter.emit(DeviceHandlerEvent.AVAILABLE, device);
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

    private async handleDisconnectedDevice(
        event: USBConnectionEvent,
    ): Promise<void> {
        const usbDevice = event.device;
        const device = this.usbDeviceMap.get(usbDevice);
        if (device === undefined) {
            return;
        }

        await device.disconnect(DeviceDisconnectReason.TRANSPORT);

        this.emitter.emit(DeviceHandlerEvent.UNAVAILABLE, device);

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
                await this.handleConnectedAoapDevice(device);
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
