import {
    HeadUnitInfo,
    DriverPosition,
    ServiceDiscoveryResponse,
} from '@web-auto/android-auto-proto';
import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from './transport/DeviceHandler.js';
import { getLogger } from '@web-auto/logging';
import { Device, DeviceDisconnectReason } from './transport/Device.js';
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
    headunitInfo: HeadUnitInfo;
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
        cryptor: Cryptor,
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

        this.controlService = this.buildControlService(this.cryptor, {
            getServiceDiscoveryResponse:
                this.getServiceDiscoveryResponse.bind(this),
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

    private async encryptFrameData(frameData: FrameData): Promise<void> {
        assert(this.cryptor !== undefined);

        const frameHeader = frameData.frameHeader;

        if (!(frameHeader.flags & FrameHeaderFlags.ENCRYPTED)) {
            return;
        }

        try {
            frameData.payload = await this.cryptor.encrypt(frameData.payload);
        } catch (err) {
            this.logger.error('Failed to encrypt', {
                frameData,
                err,
            });
            throw err;
        }
    }

    private async onSendFrameData(frameData: FrameData): Promise<void> {
        assert(this.cryptor !== undefined);
        assert(this.frameCodec !== undefined);

        const frameHeader = frameData.frameHeader;

        await this.encryptFrameData(frameData);

        frameHeader.payloadSize = frameData.payload.size;

        let buffer;
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
        if (this.connectedDevice === undefined) {
            this.logger.error('Device not connected, skip sending message', {
                serviceId,
                message,
                isEncrypted,
                isControl,
            });
            return;
        }

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

    private async getServiceDiscoveryResponse(): Promise<ServiceDiscoveryResponse> {
        assert(this.controlService !== undefined);
        assert(this.services !== undefined);

        const data = new ServiceDiscoveryResponse({
            ...this.config.headunitInfo,
            headunitInfo: this.config.headunitInfo,
            driverPosition: DriverPosition.LEFT,

            canPlayNativeMediaDuringVr: false,
            sessionConfiguration: 0,
            displayName: '',
            probeForSupport: false,
            connectionConfiguration: {
                pingConfiguration: {
                    timeoutMs: 3000,
                    intervalMs: 1000,
                    highLatencyThresholdMs: 200,
                    trackedPingCount: 5,
                },
                wirelessTcpConfiguration: undefined,
            },

            services: [],
        });

        for (const service of this.services) {
            service.fillFeatures(data);
        }

        return data;
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
            handled = await service.handleControlMessage(message);
        } else {
            handled = await service.handleSpecificMessage(message);
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

    private async decryptFrameData(frameData: FrameData): Promise<void> {
        assert(this.cryptor !== undefined);

        const frameHeader = frameData.frameHeader;

        if (!(frameHeader.flags & FrameHeaderFlags.ENCRYPTED)) {
            return;
        }

        try {
            frameData.payload = await this.cryptor.decrypt(frameData.payload);
        } catch (err) {
            this.logger.error('Failed to decrypt', {
                frameData,
                err,
            });
            throw err;
        }
    }

    private async onDeviceTransportData(
        device: Device,
        buffer: DataBuffer,
    ): Promise<void> {
        assert(this.frameCodec !== undefined);
        assert(this.messageAggregator !== undefined);

        if (!this.isDeviceConnected(device)) {
            this.logger.error(
                `Cannot accept data from ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        const frameDatas = this.frameCodec.decodeBuffer(buffer);

        for (const frameData of frameDatas) {
            await this.decryptFrameData(frameData);
        }

        for (const frameData of frameDatas) {
            const message = this.messageAggregator.aggregate(frameData);
            if (message === undefined) {
                continue;
            }

            const serviceId = frameData.frameHeader.serviceId;
            const isControl = !!(
                frameData.frameHeader.flags & FrameHeaderFlags.CONTROL
            );

            await this.onReceiveMessage(serviceId, message, isControl);
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

    protected abstract onDevicesUpdatedCallback(devices: Device[]): void;
    protected abstract onDeviceDisconnectedCallback(): void;
    protected abstract onDeviceConnectedCallback(device: Device): void;

    protected getDevices(): Device[] {
        return Array.from(this.nameDeviceMap.values());
    }

    private callOnDevicesUpdated(): void {
        const devices = this.getDevices();
        this.onDevicesUpdatedCallback(devices);
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

    private async stopServices(i?: number): Promise<void> {
        assert(this.services !== undefined);

        if (i === undefined) {
            i = this.services.length - 1;
        }

        this.logger.info('Stopping services');
        for (; i >= 0; i--) {
            const service = this.services[i];
            try {
                await service.stop();
            } catch (err) {
                this.logger.error(
                    `Failed to stop service ${service.constructor.name}`,
                    err,
                );
                throw err;
            }
        }
        this.logger.info('Stopped services');
    }

    private async startServices(): Promise<void> {
        assert(this.services !== undefined);

        this.logger.info('Starting services');
        let i = 0;
        try {
            for (; i < this.services.length; i++) {
                const service = this.services[i];
                await service.start();
            }
        } catch (err) {
            this.logger.error('Failed to start services', err);
            try {
                await this.stopServices(i - 1);
            } catch (err) {
                this.logger.error(
                    'Failure after failed to start services',
                    err,
                );
            }
            throw err;
        }
        this.logger.info('Started services');
    }

    private async startDependencies(): Promise<void> {
        assert(this.frameCodec !== undefined);
        assert(this.cryptor !== undefined);
        assert(this.services !== undefined);
        assert(this.controlService !== undefined);

        this.frameCodec.start();

        this.logger.info('Starting cryptor');
        try {
            await this.cryptor.start();
        } catch (err) {
            this.logger.info('Failed to start cryptor');
            this.frameCodec.stop();
            throw err;
        }
        this.logger.info('Started cryptor');

        await this.startServices();

        this.logger.info('Starting control service');
        try {
            await this.controlService.start();
        } catch (err) {
            this.logger.error('Failed to start control service', err);
            try {
                await this.stopServices();
                await this.cryptor.stop();
                this.frameCodec.stop();
            } catch (err) {
                this.logger.error(
                    'Failure after failed to start control service',
                    err,
                );
            }
            throw err;
        }
        this.logger.info('Started control service');
    }

    private async onDeviceConnected(device: Device): Promise<void> {
        if (this.connectedDevice !== undefined) {
            this.logger.error(
                `Cannot connect ${device.name}, ` +
                    `device ${this.connectedDevice.name} already connected`,
            );
            return;
        }

        this.connectedDevice = device;
        this.onDeviceConnectedCallback(device);

        this.logger.info(`Connected device ${device.name}`);

        try {
            this.logger.info('Starting dependencies');
            await this.startDependencies();
            this.logger.info('Started dependencies');
        } catch (err) {
            this.logger.error('Failed to start dependencies', err);
            await this.disconnectDevice(
                device,
                DeviceDisconnectReason.START_FAILED,
            );
        }
    }

    private async stopDependencies(): Promise<void> {
        assert(this.controlService !== undefined);
        assert(this.cryptor !== undefined);
        assert(this.frameCodec !== undefined);

        this.logger.info('Stopping control service');
        try {
            await this.controlService.stop();
            this.logger.info('Stopped control service');
        } catch (err) {
            this.logger.error('Failed to stop control service', err);
        }

        try {
            await this.stopServices();
        } catch (err) {
            this.logger.error('Failed to stop services', err);
        }

        this.logger.info('Stopping cryptor');
        try {
            await this.cryptor.stop();
            this.logger.info('Stopped cryptor');
        } catch (err) {
            this.logger.error('Failed to stop cryptor', err);
        }

        this.frameCodec.stop();
    }

    private async onDeviceDisconnect(
        device: Device,
        reason: string,
    ): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        if (reason === DeviceDisconnectReason.START_FAILED) {
            return;
        }

        this.logger.info('Stopping dependencies');
        try {
            await this.stopDependencies();
        } catch (err) {
            this.logger.error('Failed to stop dependencies', err);
            return;
        }
        this.logger.info('Stopped dependencies');
    }

    protected async onDeviceDisconnected(device: Device): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.info(`Disconnected ${device.name}`);
        this.connectedDevice = undefined;
        this.onDeviceDisconnectedCallback();
    }

    private async onDeviceUnavailable(device: Device): Promise<void> {
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);

        this.callOnDevicesUpdated();
    }

    public async connectDevice(device: Device): Promise<void> {
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

    public async disconnectDevice(
        device: Device,
        reason?: string,
    ): Promise<void> {
        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            return;
        }

        this.logger.info(`Disconnecting device ${device.name}`);
        try {
            await device.disconnect(reason);
        } catch (err) {
            this.logger.error(
                `Failed to disconnect device ${device.name}`,
                err,
            );
        }
    }

    public getDeviceByName(name: string): Device | undefined {
        return this.nameDeviceMap.get(name);
    }

    public getConnectedDevice(): Device | undefined {
        return this.connectedDevice;
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
