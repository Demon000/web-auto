import * as fs from 'fs';
import * as path from 'path';

import {
    UsbDeviceHandler,
    UsbDeviceHandlerEvent,
} from './usb/UsbDeviceHandler';
import { UsbTransport } from './usb/USBTransport';
import { Cryptor } from './ssl/Cryptor';
import { MessageInStream } from './messenger/MessageInStream';
import { MessageOutStream } from './messenger/MessageOutStream';
import { ControlService } from './services/ControlService';
import { ITransport, TransportEvent } from './transport/ITransport';

import { Device } from 'usb';

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

import { ServiceFactory } from './services/ServiceFactory';

type DeviceCookie = any;

type DeviceData = {
    device: DeviceCookie;
    transport: ITransport;
    cryptor: Cryptor;
    controlService: ControlService;
};

export class AndroidAutoServer {
    private deviceMap = new Map<Device, DeviceData>();
    private usbDeviceHandler = new UsbDeviceHandler();
    private started = false;

    public constructor(private serviceFactory: ServiceFactory) {
        this.usbDeviceHandler.emitter.on(
            UsbDeviceHandlerEvent.CONNECTED,
            async (device: Device) => {
                const transport = new UsbTransport(device);

                await this.initDevice(device, transport);
            },
        );

        this.usbDeviceHandler.emitter.on(
            UsbDeviceHandlerEvent.DISCONNECTED,
            (device: Device) => {
                this.deinitDevice(device);
            },
        );
    }

    public async initDevice(
        device: DeviceCookie,
        transport: ITransport,
    ): Promise<void> {
        const cryptor = new Cryptor(certificateString, privateKeyString);

        cryptor.init();

        const messageInStream = new MessageInStream(transport, cryptor);
        const messageOutStream = new MessageOutStream(transport, cryptor);

        const services = this.serviceFactory.buildServices(
            messageInStream,
            messageOutStream,
        );

        const controlService = this.serviceFactory.buildControlService(
            cryptor,
            services,
            messageInStream,
            messageOutStream,
        );

        this.deviceMap.set(device, {
            device,
            transport,
            cryptor,
            controlService,
        });

        transport.emitter.on(TransportEvent.DATA, (buffer) => {
            if (!buffer.size) {
                console.trace('Received zero-sized buffer');
                return;
            }

            messageInStream.parseBuffer(buffer);
        });
        transport.emitter.on(TransportEvent.ERROR, (err) => {
            console.log(err);
        });
        transport.init();

        await controlService.start();
    }

    public deinitDevice(device: DeviceCookie): void {
        const deviceData = this.deviceMap.get(device);
        if (deviceData === undefined) {
            return;
        }

        deviceData.controlService.stop();
        deviceData.transport.deinit();
        deviceData.cryptor.deinit();
    }

    public async start(): Promise<void> {
        if (this.started) {
            return;
        }

        await this.usbDeviceHandler.waitForDevices();
        this.started = true;
    }

    public stop(): void {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.usbDeviceHandler.stopWaitingForDevices();
        this.usbDeviceHandler.disconnectDevices();
    }
}
