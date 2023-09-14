import * as fs from 'fs';
import * as path from 'path';

import { Cryptor } from './ssl/Cryptor';
import { MessageInStream } from './messenger/MessageInStream';
import {
    MessageOutStream,
    MessageOutStreamEvent,
} from './messenger/MessageOutStream';
import { ControlService, ControlServiceEvent } from './services/ControlService';
import { Transport, TransportEvent } from './transport/Transport';

const certificateString = fs.readFileSync(path.join(__dirname, '..', 'aa.crt'));
const privateKeyString = fs.readFileSync(path.join(__dirname, '..', 'aa.key'));

import { ServiceFactory } from './services/ServiceFactory';
import { ServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import { Service } from './services';
import { DeviceHandler, DeviceHandlerEvent } from './transport/DeviceHandler';

type DeviceData = {
    transport: Transport;
    cryptor: Cryptor;
    controlService: ControlService;
    services: Service[];
};

export class AndroidAutoServer {
    private deviceMap = new Map<Transport, DeviceData>();
    private started = false;

    public constructor(
        private serviceFactory: ServiceFactory,
        private deviceHandlers: DeviceHandler[],
    ) {
        this.initDevice = this.initDevice.bind(this);
        this.deinitDevice = this.deinitDevice.bind(this);

        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.emitter.on(
                DeviceHandlerEvent.CONNECTED,
                this.initDevice,
            );

            deviceHandler.emitter.on(
                DeviceHandlerEvent.DISCONNECTED,
                this.deinitDevice,
            );
        }
    }

    public async initDevice(transport: Transport): Promise<void> {
        const cryptor = new Cryptor(certificateString, privateKeyString);

        cryptor.init();

        const messageInStream = new MessageInStream(cryptor);
        const messageOutStream = new MessageOutStream(cryptor);

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
        messageOutStream.emitter.on(
            MessageOutStreamEvent.MESSAGE_SENT,
            (buffer) => {
                transport.send(buffer);
            },
        );
        transport.emitter.on(TransportEvent.ERROR, (err) => {
            console.log(err);
        });
        transport.init();

        for (const service of services) {
            await service.start();
        }

        await controlService.start();
    }

    public deinitDevice(transport: Transport): void {
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

        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.waitForDevices();
        }
        this.started = true;
    }

    public stop(): void {
        if (!this.started) {
            return;
        }

        this.started = false;
        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.stopWaitingForDevices();
            deviceHandler.disconnectDevices();
        }
    }
}
