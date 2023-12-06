import {
    type IServiceDiscoveryResponse,
    ServiceDiscoveryRequest,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from './transport/DeviceHandler.js';
import { getLogger } from '@web-auto/logging';
import { Device } from './transport/Device.js';
import {
    ANDROID_AUTO_CERTIFICATE,
    ANDROID_AUTO_PRIVATE_KEY,
} from './crypto/keys.js';
import { FrameCodec } from './messenger/FrameCodec.js';
import { MessageAggregator } from './messenger/MessageAggregator.js';
import { Cryptor } from './crypto/Cryptor.js';
import { Service, type ServiceEvents } from './services/Service.js';
import {
    ControlService,
    type ControlServiceConfig,
    type ControlServiceEvents,
} from './services/ControlService.js';
import assert from 'node:assert';
import { type FrameData } from './messenger/FrameData.js';
import { Message } from './messenger/Message.js';
import { DataBuffer } from './utils/DataBuffer.js';
import { FrameHeaderFlags } from './messenger/FrameHeader.js';

export interface AndroidAutoServerConfig {
    controlConfig: ControlServiceConfig;
    serviceDiscovery: IServiceDiscoveryResponse;
    deviceNameWhitelist?: string[];
}

export abstract class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private connectedDevice?: Device;
    private started = false;

    private cryptor?: Cryptor;
    private frameCodec?: FrameCodec;
    private messageAggregator?: MessageAggregator;
    private services?: Service[];
    private controlService?: ControlService;
    private serviceIdServiceMap = new Map<number, Service>();
    private deviceHandlers?: DeviceHandler[];

    public constructor(protected config: AndroidAutoServerConfig) {}

    protected abstract buildDeviceHandlers(
        events: DeviceHandlerEvents,
    ): DeviceHandler[];

    protected abstract buildCryptor(
        certificateBuffer: Buffer,
        privateKeyBuffer: Buffer,
    ): Cryptor;

    protected abstract buildControlService(
        events: ControlServiceEvents,
    ): ControlService;

    protected abstract buildServices(events: ServiceEvents): Service[];

    public build(): void {
        this.deviceHandlers = this.buildDeviceHandlers({
            onDeviceAvailable: this.onDeviceAvailable.bind(this),
            onDeviceStateUpdated: this.onDeviceStateUpdated.bind(this),
            onDeviceSelfConnect: this.onDeviceSelfConnect.bind(this),
            onDeviceConnected: this.onDeviceConnected.bind(this),
            onDeviceDisconnect: this.onDeviceDisconnect.bind(this),
            onDeviceDisconnected: this.onDeviceDisconnected.bind(this),
            onDeviceUnavailable: this.onDeviceUnavailable.bind(this),
            onDeviceTransportData: this.onDeviceTransportData.bind(this),
            onDeviceTransportError: this.onDeviceTransportError.bind(this),
        });

        this.cryptor = this.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

        this.frameCodec = new FrameCodec();
        this.messageAggregator = new MessageAggregator();

        this.controlService = this.buildControlService({
            onServiceDiscoveryRequest:
                this.onServiceDiscoveryRequest.bind(this),
            onHandshake: this.onHandshake.bind(this),
            onMessageSent: this.onSendMessage.bind(this),
            onPingTimeout: this.onPingTimeout.bind(this),
        });

        this.services = this.buildServices({
            onMessageSent: this.onSendMessage.bind(this),
        });

        this.serviceIdServiceMap.set(
            this.controlService.serviceId,
            this.controlService,
        );

        for (const service of this.services) {
            this.serviceIdServiceMap.set(service.serviceId, service);
        }
    }

    private isDeviceWhitelisted(device: Device): boolean {
        if (this.config.deviceNameWhitelist === undefined) {
            return true;
        }

        return this.config.deviceNameWhitelist.includes(device.name);
    }

    private isDeviceConnected(device: Device): boolean {
        if (this.connectedDevice === undefined) {
            return false;
        }

        return this.connectedDevice === device;
    }

    private async onSendFrameData(frameData: FrameData): Promise<void> {
        assert(this.cryptor !== undefined);
        assert(this.frameCodec !== undefined);

        const frameHeader = frameData.frameHeader;
        let buffer;

        if (frameHeader.flags & FrameHeaderFlags.ENCRYPTED) {
            frameData.payload = await this.cryptor.encrypt(frameData.payload);
        }

        frameHeader.payloadSize = frameData.payload.size;

        try {
            buffer = this.frameCodec.encodeFrameData(frameData);
        } catch (err) {
            this.logger.error('Failed to encode', {
                err,
                frameData,
            });
            return;
        }

        if (
            this.connectedDevice === undefined ||
            this.connectedDevice.transport === undefined
        ) {
            this.logger.error('Cannot send frame without a connected device');
            return;
        }

        try {
            await this.connectedDevice.transport.send(buffer);
        } catch (err) {
            this.logger.error('Failed to send', err);
        }
    }

    private async onSendMessage(
        serviceId: number,
        message: Message,
        isEncrypted: boolean,
        isControl: boolean,
    ): Promise<void> {
        assert(this.messageAggregator !== undefined);

        const frameDatas = this.messageAggregator.split(
            serviceId,
            message,
            isEncrypted,
            isControl,
        );

        for (const frameData of frameDatas) {
            await this.onSendFrameData(frameData);
        }
    }

    private async sendServiceDiscoveryResponse(): Promise<void> {
        assert(this.controlService !== undefined);
        assert(this.services !== undefined);

        const data = ServiceDiscoveryResponse.create(
            this.config.serviceDiscovery,
        );

        for (const service of this.services) {
            service.fillFeatures(data);
        }

        await this.controlService.sendDiscoveryResponse(data);
    }

    private async onServiceDiscoveryRequest(
        data: ServiceDiscoveryRequest,
    ): Promise<void> {
        this.logger.info(
            `Discovery request, brand: ${data.deviceBrand}, device name ${data.deviceName}`,
        );

        await this.sendServiceDiscoveryResponse();
    }

    private async onHandshake(payload?: DataBuffer): Promise<void> {
        assert(this.cryptor !== undefined);
        assert(this.controlService !== undefined);

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

    private async onPingTimeout(): Promise<void> {
        if (this.connectedDevice === undefined) {
            this.logger.error(
                'Cannot send ping timeout without a connected device',
            );
            return;
        }

        this.logger.error(
            `Pinger timed out, disconnecting ${this.connectedDevice.name}`,
        );

        await this.disconnectDevice(this.connectedDevice);
    }

    private async onReceiveMessage(
        serviceId: number,
        message: Message,
        isControl: boolean,
    ): Promise<void> {
        const service = this.serviceIdServiceMap.get(serviceId);
        if (service === undefined) {
            this.logger.error(
                `Unhandled message with id ${message.messageId} ` +
                    `on service with id ${serviceId}`,
                message,
            );
            return;
        }

        let handled;
        if (isControl) {
            handled = await service.onControlMessage(message);
        } else {
            handled = await service.onSpecificMessage(message);
        }

        if (!handled) {
            const tag = isControl ? 'control' : 'specific';

            this.logger.error(
                `Unhandled ${tag} message with id ${message.messageId} ` +
                    `on service with id ${serviceId}`,
                message.getPayload(),
            );
        }
    }

    private async onReceiveFrameData(
        frameData: FrameData,
    ): Promise<Message | undefined> {
        assert(this.cryptor !== undefined);
        assert(this.messageAggregator !== undefined);

        const frameHeader = frameData.frameHeader;

        if (frameHeader.flags & FrameHeaderFlags.ENCRYPTED) {
            try {
                frameData.payload = await this.cryptor.decrypt(
                    frameData.payload,
                );
            } catch (err) {
                this.logger.error('Failed to decrypt', {
                    frameData,
                    err,
                });
                return undefined;
            }
        }

        return this.messageAggregator.aggregate(frameData);
    }

    private async onDeviceTransportData(
        device: Device,
        buffer: DataBuffer,
    ): Promise<void> {
        assert(this.frameCodec !== undefined);

        if (!this.isDeviceConnected(device)) {
            this.logger.error(
                `Cannot accept data from ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        const frameDatas = this.frameCodec.decodeBuffer(buffer);

        const messages: [number, Message, boolean][] = [];
        for (const frameData of frameDatas) {
            const message = await this.onReceiveFrameData(frameData);
            if (message === undefined) {
                continue;
            }

            messages.push([
                frameData.frameHeader.serviceId,
                message,
                !!(frameData.frameHeader.flags & FrameHeaderFlags.CONTROL),
            ]);
        }

        for (const message of messages) {
            await this.onReceiveMessage(message[0], message[1], message[2]);
        }
    }
    private async onDeviceTransportError(
        device: Device,
        err: Error,
    ): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.error(
                `Cannot accept error from ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.error(`Received transport error from ${device.name}`, err);
    }

    protected abstract onDevicesUpdated(devices: Device[]): void;

    protected getDevicesImpl(): Device[] {
        return Array.from(this.nameDeviceMap.values());
    }

    private callOnDevicesUpdated(): void {
        const devices = this.getDevicesImpl();
        this.onDevicesUpdated(devices);
    }

    private async onDeviceSelfConnect(device: Device): Promise<boolean> {
        if (this.connectedDevice !== undefined) {
            this.logger.error(
                `Cannot accept self connection from ${device.name}, ` +
                    `${this.connectedDevice.name} already connected`,
            );

            return false;
        }

        if (!this.isDeviceWhitelisted(device)) {
            this.logger.error(
                `Cannot accept self connection from ${device.name}, ` +
                    'device is not whitelisted',
            );
            return false;
        }

        return true;
    }

    private async onDeviceAvailable(device: Device): Promise<void> {
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        this.callOnDevicesUpdated();
    }

    private async onDeviceStateUpdated(device: Device): Promise<void> {
        assert(this.nameDeviceMap.has(device.name));

        this.callOnDevicesUpdated();
    }

    private async onDeviceConnected(device: Device): Promise<void> {
        assert(this.frameCodec !== undefined);
        assert(this.cryptor !== undefined);
        assert(this.services !== undefined);
        assert(this.controlService !== undefined);

        if (this.connectedDevice !== undefined) {
            this.logger.error(
                `Cannot connect ${device.name}, ` +
                    `device ${this.connectedDevice.name} already connected`,
            );
            return;
        }

        this.connectedDevice = device;

        this.logger.info(`Connected device ${device.name}`);

        this.frameCodec.start();

        this.logger.info('Starting cryptor');
        await this.cryptor.start();
        this.logger.info('Started cryptor');

        this.logger.info('Starting services');
        for (const service of this.services) {
            await service.start();
        }
        this.logger.info('Started services');

        this.logger.info('Starting control service');
        await this.controlService.start();
        this.logger.info('Started control service');
    }

    private async onDeviceDisconnect(device: Device): Promise<void> {
        assert(this.frameCodec !== undefined);
        assert(this.cryptor !== undefined);
        assert(this.services !== undefined);
        assert(this.controlService !== undefined);

        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.info('Stopping control service');
        await this.controlService.stop();
        this.logger.info('Stopped control service');
        this.logger.info('Stopping services');
        for (const service of this.services) {
            await service.stop();
        }
        this.logger.info('Stopped services');

        this.logger.info('Stopping cryptor');
        await this.cryptor.stop();
        this.logger.info('Stopped cryptor');

        this.frameCodec.stop();
    }

    private async onDeviceDisconnected(device: Device): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.info(`Disconnected ${device.name}`);
        this.connectedDevice = undefined;
    }

    private async onDeviceUnavailable(device: Device): Promise<void> {
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);

        this.callOnDevicesUpdated();
    }

    private async connectDevice(device: Device): Promise<void> {
        if (!this.isDeviceWhitelisted(device)) {
            throw new Error(
                `Cannot connect to ${device.name}, ` +
                    'device is not whitelisted',
            );
        }

        if (this.connectedDevice !== undefined) {
            await this.disconnectDevice(this.connectedDevice);
        }

        this.logger.info(`Connecting device ${device.name}`);
        try {
            await device.connect();
        } catch (err) {
            this.logger.error(`Failed to connect to ${device.name}`, err);
            return;
        }
    }

    private async disconnectDevice(device: Device): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.info(`Disconnecting device ${device.name}`);
        try {
            await device.disconnect();
        } catch (err) {
            this.logger.error(
                `Failed to disconnect device ${device.name}`,
                err,
            );
        }
    }

    public async connectDeviceName(name: string): Promise<void> {
        const device = this.nameDeviceMap.get(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.connectDevice(device);
    }

    public async disconnectDeviceName(name: string): Promise<void> {
        const device = this.nameDeviceMap.get(name);
        if (device === undefined) {
            throw new Error(`Unknown device ${name}`);
        }

        await this.disconnectDevice(device);
    }

    public async start(): Promise<void> {
        assert(this.deviceHandlers !== undefined);

        if (this.started) {
            return;
        }

        this.logger.info('Server starting');

        for (const deviceHandler of this.deviceHandlers) {
            try {
                await deviceHandler.waitForDevices();
            } catch (err) {
                this.logger.error('Failed to start waiting for devices', err);
            }
        }

        this.logger.info('Server started');

        this.started = true;
    }

    public async stop(): Promise<void> {
        assert(this.deviceHandlers !== undefined);

        if (!this.started) {
            return;
        }

        this.logger.info('Server stopping');

        this.started = false;

        if (this.connectedDevice !== undefined) {
            await this.disconnectDevice(this.connectedDevice);
        }

        for (const deviceHandler of this.deviceHandlers) {
            try {
                await deviceHandler.stopWaitingForDevices();
            } catch (err) {
                this.logger.error('Failed to stop waiting for devices', err);
            }
        }

        this.logger.info('Server stopped');
    }
}
