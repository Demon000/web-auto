import * as fs from 'fs';
import * as path from 'path';

import { UsbDeviceHandler } from './transport/UsbDeviceHandler';
import { Cryptor } from './ssl/Cryptor';
import { MessageInStream } from './messenger/MessageInStream';
import { MessageOutStream } from './messenger/MessageOutStream';
import { ControlService, ControlServiceEvent } from './services/ControlService';
import { ITransport, TransportEvent } from './transport/ITransport';

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

import { ServiceFactory } from './services/ServiceFactory';
import { ServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import { Service } from './services';
import { DeviceHandlerEvent } from './transport/DeviceHandler';

type DeviceData = {
    transport: ITransport;
    cryptor: Cryptor;
    controlService: ControlService;
    services: Service[];
};

export class AndroidAutoServer {
    private deviceMap = new Map<ITransport, DeviceData>();
    private usbDeviceHandler = new UsbDeviceHandler();
    private started = false;

    public constructor(private serviceFactory: ServiceFactory) {
        this.initDevice = this.initDevice.bind(this);
        this.deinitDevice = this.deinitDevice.bind(this);
        this.usbDeviceHandler.emitter.on(
            DeviceHandlerEvent.CONNECTED,
            this.initDevice,
        );

        this.usbDeviceHandler.emitter.on(
            DeviceHandlerEvent.DISCONNECTED,
            this.deinitDevice,
        );
    }

    public async initDevice(transport: ITransport): Promise<void> {
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
            messageInStream,
            messageOutStream,
        );

        const sendServiceDiscoveryResponse = () => {
            const data = ServiceDiscoveryResponse.create({
                headUnitName: 'OpenAuto',
                carModel: 'Universal',
                carYear: '2018',
                carSerial: '20180301',
                leftHandDriveVehicle: false,
                headunitManufacturer: 'f1x',
                headunitModel: 'OpenAuto Autoapp',
                swBuild: '1',
                swVersion: '1.0',
                canPlayNativeMediaDuringVr: false,
                hideClock: false,
            });

            for (const service of services) {
                service.fillFeatures(data);
            }

            controlService.sendDiscoveryResponse(data);
        };

        controlService.emitter.once(
            ControlServiceEvent.SERVICE_DISCOVERY_REQUEST,
            (data) => {
                console.log(
                    `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
                );

                sendServiceDiscoveryResponse();
            },
        );

        this.deviceMap.set(transport, {
            transport,
            cryptor,
            controlService,
            services,
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

        for (const service of services) {
            await service.start();
        }

        await controlService.start();
    }

    public deinitDevice(transport: ITransport): void {
        const deviceData = this.deviceMap.get(transport);
        if (deviceData === undefined) {
            return;
        }

        for (const service of deviceData.services) {
            service.stop();
        }

        deviceData.controlService.stop();
        deviceData.cryptor.deinit();
        deviceData.transport.deinit();
    }

    public async start(): Promise<void> {
        if (this.started) {
            return;
        }

        this.usbDeviceHandler.waitForDevices();
        this.started = true;
    }

    public stop(): void {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.usbDeviceHandler.stopWaitingForDevices();
        this.usbDeviceHandler.disconnectDevices();
        // this.tcpDeviceHandler.disconnectDevices();
    }
}
