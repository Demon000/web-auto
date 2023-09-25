import { Cryptor } from './crypto/Cryptor';
import {
    MessageInStream,
    MessageInStreamEvent,
} from './messenger/MessageInStream';
import {
    MessageOutStream,
    MessageOutStreamEvent,
} from './messenger/MessageOutStream';
import { ControlServiceEvent } from './services/ControlService';
import { Transport, TransportEvent } from './transport/Transport';

import { ServiceFactory } from './services/ServiceFactory';
import { ServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import { Service, ServiceEvent } from './services';
import { DeviceHandler, DeviceHandlerEvent } from './transport/DeviceHandler';
import { ChannelId } from './messenger/ChannelId';
import {
    ANDROID_AUTO_CERTIFICATE,
    ANDROID_AUTO_PRIVATE_KEY,
} from './crypto/keys';
import { DataBuffer } from '.';
import { EncryptionType } from './messenger/EncryptionType';
import { Message } from './messenger/Message';

type DeviceData = {
    transport: Transport;
    cryptor: Cryptor;
    messageInStream: MessageInStream;
    messageOutStream: MessageOutStream;
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
        const cryptor = this.serviceFactory.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

        cryptor.init();

        const messageInStream = new MessageInStream();
        const messageOutStream = new MessageOutStream();

        const services = this.serviceFactory.buildServices();
        const controlService = this.serviceFactory.buildControlService();
        const allServices = [...services, controlService];

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

        controlService.extraEmitter.once(
            ControlServiceEvent.SERVICE_DISCOVERY_REQUEST,
            (data) => {
                console.log(
                    `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
                );

                sendServiceDiscoveryResponse();
            },
        );

        controlService.extraEmitter.on(
            ControlServiceEvent.HANDSHAKE,
            async (payload) => {
                if (payload !== undefined) {
                    await cryptor.writeHandshakeBuffer(payload);
                }

                if (cryptor.doHandshake()) {
                    console.log('Auth completed');

                    await controlService.sendAuthComplete();
                } else {
                    console.log('Continue handshake');

                    const payload = await cryptor.readHandshakeBuffer();
                    await controlService.sendHandshake(payload);
                }
            },
        );

        this.deviceMap.set(transport, {
            transport,
            cryptor,
            messageInStream,
            messageOutStream,
            services: allServices,
        });

        const channelIdServiceMap = new Map<ChannelId, Service>();

        for (const service of allServices) {
            channelIdServiceMap.set(service.channelId, service);
        }

        messageInStream.emitter.on(
            MessageInStreamEvent.MESSAGE_RECEIVED,
            async (payloads, frameHeader, totalSize) => {
                const promises = [];
                for (const payload of payloads) {
                    if (
                        frameHeader.encryptionType === EncryptionType.ENCRYPTED
                    ) {
                        try {
                            promises.push(cryptor.decrypt(payload));
                        } catch (err) {
                            console.log(err);
                            return;
                        }
                    }
                }

                if (frameHeader.encryptionType === EncryptionType.ENCRYPTED) {
                    payloads = await Promise.all(promises);
                }

                const buffer = DataBuffer.fromSize(0);
                for (const payload of payloads) {
                    buffer.appendBuffer(payload);
                }

                if (totalSize !== 0 && totalSize !== buffer.size) {
                    throw new Error(
                        `Received compound message for channel ${frameHeader.channelId} ` +
                            `but size ${buffer.size} does not ` +
                            `match total size ${totalSize}`,
                    );
                }

                const message = new Message({ rawPayload: buffer });

                const service = channelIdServiceMap.get(frameHeader.channelId);
                if (service === undefined) {
                    console.log(
                        `Unhandled message with id ${message.messageId} ` +
                            `on channel with id ${frameHeader.channelId}`,
                        message.getPayload(),
                        frameHeader,
                    );
                    return;
                }

                service.onMessage(message);
            },
        );

        messageOutStream.emitter.on(
            MessageOutStreamEvent.MESSAGE_SENT,
            async (payload, frameHeader, totalSize) => {
                if (frameHeader.encryptionType === EncryptionType.ENCRYPTED) {
                    payload = await cryptor.encrypt(payload);
                }

                frameHeader.payloadSize = payload.size;

                const buffer = DataBuffer.empty();
                buffer.appendBuffer(frameHeader.toBuffer());
                if (totalSize !== 0) {
                    buffer.appendUint32BE(totalSize);
                }
                buffer.appendBuffer(payload);

                transport.send(buffer);
            },
        );

        transport.emitter.on(TransportEvent.DATA, (buffer) => {
            messageInStream.parseBuffer(buffer);
        });

        transport.emitter.on(TransportEvent.ERROR, (err) => {
            console.log(err);
        });

        for (const service of allServices) {
            service.emitter.on(
                ServiceEvent.MESSAGE_SENT,
                (message, options) => {
                    messageOutStream.send(message, {
                        channelId: service.channelId,
                        ...options,
                    });
                },
            );
        }

        transport.init();

        for (const service of allServices) {
            await service.start();
        }
    }

    public deinitDevice(transport: Transport): void {
        const deviceData = this.deviceMap.get(transport);
        if (deviceData === undefined) {
            return;
        }

        for (const service of deviceData.services) {
            service.stop();
        }

        deviceData.messageInStream.stop();
        deviceData.messageOutStream.stop();
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
            deviceHandler.stop();
        }
    }
}
