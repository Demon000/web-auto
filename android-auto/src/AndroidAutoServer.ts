import {
    MessageInStream,
    MessageInStreamEvent,
} from './messenger/MessageInStream';
import {
    MessageOutStream,
    MessageOutStreamEvent,
} from './messenger/MessageOutStream';
import { ControlServiceEvent } from './services/ControlService';

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
import { DataBuffer, TransportEvent } from '.';
import { EncryptionType } from './messenger/EncryptionType';
import { Message } from './messenger/Message';
import { getLogger } from '@web-auto/logging';
import { Device, DeviceEvent } from './transport/Device';
import assert from 'node:assert';

export interface AndroidAutoServerConfig {
    serviceDiscovery: IServiceDiscoveryResponse;
    deviceNameWhitelist?: string[];
}

export interface DeviceData {
    services: Service[];
}

export class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private nameDeviceDataMap = new Map<string, DeviceData>();
    private started = false;

    public constructor(
        private options: AndroidAutoServerConfig,
        private serviceFactory: ServiceFactory,
        private deviceHandlers: DeviceHandler[],
    ) {
        this.onDeviceAvailable = this.onDeviceAvailable.bind(this);
        this.onDeviceUnavailable = this.onDeviceUnavailable.bind(this);

        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.emitter.on(
                DeviceHandlerEvent.AVAILABLE,
                this.onDeviceAvailable,
            );
            deviceHandler.emitter.on(
                DeviceHandlerEvent.UNAVAILABLE,
                this.onDeviceUnavailable,
            );
        }
    }

    public async onDeviceAvailable(device: Device): Promise<void> {
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        device.emitter.on(DeviceEvent.CONNECTED, () => {
            this.onDeviceConnected(device);
        });

        if (
            this.options.deviceNameWhitelist !== undefined &&
            !this.options.deviceNameWhitelist.includes(device.name)
        ) {
            return;
        }

        try {
            await device.connect();
        } catch (e) {
            this.logger.error(`Failed to connect to device ${device.name}`, {
                metadata: e,
            });
        }
    }

    public async onDeviceConnected(device: Device): Promise<void> {
        assert(device.transport !== undefined);
        const transport = device.transport;

        this.logger.info(`New connected device ${device.name}`);

        device.emitter.on(DeviceEvent.DISCONNECTED, () => {
            this.onDeviceDisconnected(device);
        });

        const cryptor = this.serviceFactory.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

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

                if (cryptor.isHandshakeComplete()) {
                    this.logger.debug('Auth completed');

                    await controlService.sendAuthComplete();
                } else {
                    this.logger.debug('Continue handshake');

                    const payload = await cryptor.readHandshakeBuffer();
                    await controlService.sendHandshake(payload);
                }
            },
        );

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

        transport.emitter.on(TransportEvent.ERROR, (e) => {
            this.logger.error('Connection failed', {
                metadata: e,
            });
        });

        controlService.extraEmitter.once(
            ControlServiceEvent.PING_TIMEOUT,
            () => {
                this.logger.error(
                    `Pinger timed out, disconnecting ${device.name}`,
                );
                device.disconnect();
            },
        );

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

        this.nameDeviceDataMap.set(device.name, {
            services: allServices,
        });

        for (const service of allServices) {
            await service.start();
        }
    }

    public async onDeviceDisconnected(device: Device): Promise<void> {
        const deviceData = this.nameDeviceDataMap.get(device.name);
        assert(deviceData !== undefined);
        const { services: allServices } = deviceData;

        this.nameDeviceMap.delete(device.name);

        this.logger.error(`Disconnected ${device.name}`);

        for (const service of allServices) {
            service.stop();
        }
    }

    public onDeviceUnavailable(device: Device): void {
        this.nameDeviceMap.delete(device.name);
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

        for (const device of this.nameDeviceMap.values()) {
            device.disconnect();
        }

        for (const deviceHandler of this.deviceHandlers) {
            deviceHandler.stopWaitingForDevices();
        }
    }
}
