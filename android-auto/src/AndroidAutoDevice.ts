import {
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import { Cryptor } from './crypto/Cryptor';
import {
    ANDROID_AUTO_CERTIFICATE,
    ANDROID_AUTO_PRIVATE_KEY,
} from './crypto/keys';
import { FrameCodec } from './messenger/FrameCodec';
import { MessageAggregator } from './messenger/MessageAggregator';
import { ControlService } from './services/ControlService';
import { Service } from './services/Service';
import { ServiceFactory } from './services/ServiceFactory';
import { Device, DeviceEvent } from './transport/Device';
import {
    AndroidAutoServerConfig,
    ChannelId,
    DataBuffer,
    Transport,
    TransportEvent,
} from '.';
import { Logger } from 'winston';
import { getLogger } from '@web-auto/logging';
import { FrameData } from './messenger/FrameData';
import { EncryptionType } from './messenger/EncryptionType';
import assert from 'node:assert';
import { Message } from './messenger/Message';

export interface AndroidAutoDeviceEvents {
    onDisconnected: (device: AndroidAutoDevice) => Promise<void>;
}

export class AndroidAutoDevice {
    private cryptor: Cryptor;
    private frameCodec: FrameCodec;
    private messageAggregator: MessageAggregator;
    private services: Service[];
    private controlService: ControlService;
    private allServices: Service[];
    private logger: Logger;
    private channelIdServiceMap = new Map<ChannelId, Service>();
    private transport?: Transport;

    public constructor(
        private options: AndroidAutoServerConfig,
        private serviceFactory: ServiceFactory,
        public device: Device,
        private events: AndroidAutoDeviceEvents,
    ) {
        this.logger = getLogger(
            `${this.constructor.name}@${this.device.realName}`,
        );

        this.onDiscoveryRequest = this.onDiscoveryRequest.bind(this);
        this.onHandshake = this.onHandshake.bind(this);
        this.onReceiveBuffer = this.onReceiveBuffer.bind(this);
        this.onPingTimeout = this.onPingTimeout.bind(this);
        this.onSendMessage = this.onSendMessage.bind(this);
        this.onDeviceDisconnected = this.onDeviceDisconnected.bind(this);

        this.cryptor = this.serviceFactory.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

        this.frameCodec = new FrameCodec(this.cryptor);
        this.messageAggregator = new MessageAggregator();

        this.services = this.serviceFactory.buildServices({
            onMessageSent: this.onSendMessage,
        });
        this.controlService = this.serviceFactory.buildControlService({
            onDiscoveryRequest: this.onDiscoveryRequest,
            onHandshake: this.onHandshake,
            onPingTimeout: this.onPingTimeout,
            onMessageSent: this.onSendMessage,
        });
        this.allServices = [...this.services, this.controlService];

        for (const service of this.allServices) {
            this.channelIdServiceMap.set(service.channelId, service);
        }
    }

    private attachEventListeners(): void {
        this.device.emitter.on(
            DeviceEvent.DISCONNECTED,
            this.onDeviceDisconnected,
        );

        assert(this.transport !== undefined);
        this.transport.emitter.on(TransportEvent.DATA, this.onReceiveBuffer);

        this.transport.emitter.on(TransportEvent.ERROR, this.onTransportError);
    }

    private detachEventListeners(): void {
        this.device.emitter.off(
            DeviceEvent.DISCONNECTED,
            this.onDeviceDisconnected,
        );

        assert(this.transport !== undefined);
        this.transport.emitter.off(TransportEvent.DATA, this.onReceiveBuffer);

        this.transport.emitter.off(TransportEvent.ERROR, this.onTransportError);
    }

    private onTransportError(e: Error): void {
        this.logger.error('Connection failed', {
            metadata: e,
        });
    }

    private async sendServiceDiscoveryResponse(): Promise<void> {
        const data = ServiceDiscoveryResponse.create(
            this.options.serviceDiscovery,
        );

        for (const service of this.services) {
            service.fillFeatures(data);
        }

        await this.controlService.sendDiscoveryResponse(data);
    }

    private async onDiscoveryRequest(
        data: ServiceDiscoveryRequest,
    ): Promise<void> {
        this.logger.info(
            `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
        );

        await this.sendServiceDiscoveryResponse();
    }

    private async onHandshake(payload?: DataBuffer): Promise<void> {
        if (payload !== undefined) {
            await this.cryptor.writeHandshakeBuffer(payload);
        }

        if (this.cryptor.isHandshakeComplete()) {
            this.logger.debug('Auth completed');

            await this.controlService.sendAuthComplete();
        } else {
            this.logger.debug('Continue handshake');

            const payload = await this.cryptor.readHandshakeBuffer();
            await this.controlService.sendHandshake(payload);
        }
    }

    private async onReceiveMessage(message: Message): Promise<void> {
        const service = this.channelIdServiceMap.get(message.channelId);
        if (service === undefined) {
            this.logger.error(
                `Unhandled message with id ${message.messageId} ` +
                    `on channel with id ${message.channelId}`,
                {
                    metadata: message,
                },
            );
            return;
        }

        await service.onMessage(message);
    }

    private async onReceiveFrameData(frameData: FrameData): Promise<void> {
        const frameHeader = frameData.frameHeader;

        if (frameHeader.encryptionType === EncryptionType.ENCRYPTED) {
            try {
                frameData.payload = await this.cryptor.decrypt(
                    frameData.payload,
                );
            } catch (err) {
                this.logger.error('Failed to decrypt', {
                    metadata: {
                        frameData,
                        err,
                    },
                });
                return;
            }
        }

        const message = this.messageAggregator.aggregate(frameData);
        if (message === undefined) {
            return;
        }

        await this.onReceiveMessage(message);
    }

    private async onReceiveBuffer(buffer: DataBuffer): Promise<void> {
        const frameDatas = this.frameCodec.decodeBuffer(buffer);

        for (const frameData of frameDatas) {
            await this.onReceiveFrameData(frameData);
        }
    }

    private async onSendFrameData(frameData: FrameData): Promise<void> {
        const frameHeader = frameData.frameHeader;
        let buffer;

        if (frameHeader.encryptionType === EncryptionType.ENCRYPTED) {
            frameData.payload = await this.cryptor.encrypt(frameData.payload);
        }

        try {
            buffer = this.frameCodec.encodeFrameData(frameData);
        } catch (err) {
            this.logger.error('Failed to encode', {
                metadata: {
                    err,
                    frameData,
                },
            });
            return;
        }

        assert(this.transport !== undefined);
        try {
            await this.transport.send(buffer);
        } catch (err) {
            this.logger.error('Failed to send', {
                metadata: err,
            });
        }
    }

    private async onSendMessage(
        message: Message,
        encryptionType: EncryptionType,
    ): Promise<void> {
        const frameDatas = this.messageAggregator.split(
            message,
            encryptionType,
        );

        for (const frameData of frameDatas) {
            await this.onSendFrameData(frameData);
        }
    }

    public async connect(): Promise<void> {
        this.transport = await this.device.connect();

        this.attachEventListeners();

        for (const service of this.allServices) {
            await service.start();
        }
    }

    private async onDeviceDisconnected(): Promise<void> {
        await this.disconnect(false, true);
    }

    private async onPingTimeout(): Promise<void> {
        this.logger.error(
            `Pinger timed out, disconnecting ${this.device.name}`,
        );

        await this.disconnect(true, true);
    }

    public async disconnect(
        callDisconnect = true,
        emitEvent = false,
    ): Promise<void> {
        for (const service of this.allServices) {
            service.stop();
        }

        this.detachEventListeners();

        if (callDisconnect) {
            this.logger.info(`Disconnecting device ${this.device.name}`);
            try {
                await this.device.disconnect();
            } catch (err) {
                this.logger.error(
                    `Failed to disconnect device ${this.device.name}`,
                    {
                        metadata: err,
                    },
                );
            }
        }

        if (emitEvent) {
            await this.events.onDisconnected(this);
        }
    }
}
