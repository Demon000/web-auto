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
import {
    IServiceDiscoveryResponse,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
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
import { getLogger } from '@web-auto/logging';

type DeviceData = {
    transport: Transport;
    cryptor: Cryptor;
    messageInStream: MessageInStream;
    messageOutStream: MessageOutStream;
    services: Service[];
};

export interface AndroidAutoServerConfig {
    serviceDiscovery: IServiceDiscoveryResponse;
}

export class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private deviceMap = new Map<Transport, DeviceData>();
    private started = false;

    public constructor(
        private options: AndroidAutoServerConfig,
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
            const data = ServiceDiscoveryResponse.create(
                this.options.serviceDiscovery,
            );

            for (const service of services) {
                service.fillFeatures(data);
            }

            controlService.sendDiscoveryResponse(data);
        };

        controlService.extraEmitter.once(
            ControlServiceEvent.SERVICE_DISCOVERY_REQUEST,
            (data) => {
                this.logger.info(
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
                    this.logger.debug('Auth completed');

                    await controlService.sendAuthComplete();
                } else {
                    this.logger.debug('Continue handshake');

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
                if (frameHeader.encryptionType === EncryptionType.ENCRYPTED) {
                    payloads = await cryptor.decryptMultiple(payloads);
                }

                const buffer = DataBuffer.fromMultiple(payloads);

                if (totalSize !== 0 && totalSize !== buffer.size) {
                    this.logger.error(
                        `Received compound message for channel ${frameHeader.channelId} ` +
                            `but size ${buffer.size} does not ` +
                            `match total size ${totalSize}`,
                    );
                    return;
                }

                const message = new Message({ rawPayload: buffer });

                const service = channelIdServiceMap.get(frameHeader.channelId);
                if (service === undefined) {
                    this.logger.error(
                        `Unhandled message with id ${message.messageId} ` +
                            `on channel with id ${frameHeader.channelId}`,
                        {
                            metadata: {
                                payload: message.getPayload(),
                                frameHeader,
                            },
                        },
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

                await transport.send(buffer);
            },
        );

        transport.emitter.on(TransportEvent.DATA, (buffer) => {
            messageInStream.parseBuffer(buffer);
        });

        transport.emitter.on(TransportEvent.ERROR, (err) => {
            this.logger.error(err);
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

        await transport.init();

        for (const service of allServices) {
            await service.start();
        }
    }

    public async deinitDevice(transport: Transport): Promise<void> {
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
        await deviceData.transport.deinit();
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
