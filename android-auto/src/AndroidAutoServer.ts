import { ServiceDiscoveryResponse } from '@web-auto/android-auto-proto';
import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from './transport/DeviceHandler.js';
import { getLogger } from '@web-auto/logging';
import {
    Device,
    DeviceDisconnectReason,
    DeviceState,
} from './transport/Device.js';
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
    type ControlServiceEvents,
} from './services/ControlService.js';
import { type FrameData } from './messenger/FrameData.js';
import { FrameHeaderFlags } from './messenger/FrameHeader.js';
import { Mutex } from 'async-mutex';
import { MessageCodec } from './messenger/MessageCodec.js';
import { Message as ProtoMessage } from '@bufbuild/protobuf';

export interface AndroidAutoServerBuilder {
    buildDeviceHandlers(events: DeviceHandlerEvents): DeviceHandler[];

    buildCryptor(certificateBuffer: Buffer, privateKeyBuffer: Buffer): Cryptor;

    buildControlService(
        cryptor: Cryptor,
        serviceDiscoveryResponse: ServiceDiscoveryResponse,
        events: ControlServiceEvents,
    ): ControlService;

    buildServices(events: ServiceEvents): Service[];

    buildServiceDiscoveryResponse(
        services: Service[],
    ): ServiceDiscoveryResponse;
}

export abstract class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private connectedDevice: Device | undefined;
    private started = false;

    private cryptor: Cryptor;
    private frameCodec: FrameCodec;
    private messageCodec: MessageCodec;
    private messageAggregator: MessageAggregator;
    private services: Service[];
    private controlService: ControlService;
    private serviceIdServiceMap = new Map<number, Service>();
    private deviceHandlers: DeviceHandler[];
    private connectionLock = new Mutex();

    public constructor(builder: AndroidAutoServerBuilder) {
        this.deviceHandlers = builder.buildDeviceHandlers({
            onDeviceAvailable: this.onDeviceAvailable.bind(this),
            onDeviceSelfConnection: this.connectDevice.bind(this),
            onDeviceSelfDisconnection: this.disconnectDevice.bind(this),
            onDeviceStateUpdated: this.onDeviceStateUpdated.bind(this),
            onDeviceUnavailable: this.onDeviceUnavailable.bind(this),
            onDeviceTransportData: this.onDeviceTransportData.bind(this),
            onDeviceTransportError: this.onDeviceTransportError.bind(this),
        });

        this.cryptor = builder.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

        this.messageCodec = new MessageCodec();
        this.frameCodec = new FrameCodec();
        this.messageAggregator = new MessageAggregator();

        this.services = builder.buildServices({
            onProtoMessageSent: this.onSendProtoMessage.bind(this),
            onPayloadMessageSent: this.onSendPayloadMessage.bind(this),
        });

        const serviceDiscoveryResponse = builder.buildServiceDiscoveryResponse(
            this.services,
        );

        this.controlService = builder.buildControlService(
            this.cryptor,
            serviceDiscoveryResponse,
            {
                onProtoMessageSent: this.onSendProtoMessage.bind(this),
                onPayloadMessageSent: this.onSendPayloadMessage.bind(this),
                onPingTimeout: this.onPingTimeout.bind(this),
            },
        );

        this.serviceIdServiceMap.set(
            this.controlService.serviceId,
            this.controlService,
        );

        for (const service of this.services) {
            this.serviceIdServiceMap.set(service.serviceId, service);
        }
    }

    private isDeviceConnected(device: Device): boolean {
        if (this.connectedDevice === undefined) {
            return false;
        }

        return this.connectedDevice === device;
    }

    private async encryptFrameData(frameData: FrameData): Promise<void> {
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
        const frameHeader = frameData.frameHeader;

        await this.encryptFrameData(frameData);

        if (
            this.connectedDevice === undefined ||
            this.connectedDevice.transport === undefined
        ) {
            this.logger.error('Cannot send frame without a connected device');
            return;
        }

        frameHeader.payloadSize = frameData.payload.byteLength;

        const buffer = this.frameCodec.encodeFrameData(frameData);

        return this.connectedDevice.transport.send(buffer);
    }

    private onSendMessage(
        serviceId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        if (this.connectedDevice === undefined) {
            this.logger.error('Device not connected, skip sending message', {
                serviceId,
                payload,
                isEncrypted,
                isControl,
            });
            return;
        }

        const frameDatas = this.messageAggregator.split(
            serviceId,
            payload,
            isEncrypted,
            isControl,
        );

        for (const frameData of frameDatas) {
            this.onSendFrameData(frameData)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to send frame data', err);
                });
        }
    }

    private onSendPayloadMessage(
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        const totalPayload = this.messageCodec.encodePayload(
            messageId,
            payload,
        );

        this.onSendMessage(serviceId, totalPayload, isEncrypted, isControl);
    }
    private onSendProtoMessage(
        serviceId: number,
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        const totalPayload = this.messageCodec.encodeMessage(
            messageId,
            protoMessage,
        );

        this.onSendMessage(serviceId, totalPayload, isEncrypted, isControl);
    }

    private onPingTimeout(): void {
        if (this.connectedDevice === undefined) {
            this.logger.error(
                'Cannot send ping timeout without a connected device',
            );
            return;
        }

        this.logger.error(
            `Pinger timed out, disconnecting ${this.connectedDevice.name}`,
        );

        this.disconnectDeviceAsync(this.connectedDevice)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle ping timeout', err);
            });
    }

    private async onReceiveMessage(
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isControl: boolean,
    ): Promise<void> {
        const service = this.serviceIdServiceMap.get(serviceId);
        if (service === undefined) {
            this.logger.error(
                `Unhandled message with id ${messageId} ` +
                    `on service with id ${serviceId}`,
                payload,
            );
            return;
        }

        let handled;
        if (isControl) {
            handled = await service.handleControlMessage(messageId, payload);
        } else {
            handled = await service.handleSpecificMessage(messageId, payload);
        }

        if (!handled) {
            const tag = isControl ? 'control' : 'specific';

            this.logger.error(
                `Unhandled ${tag} message with id ${messageId} ` +
                    `on service ${service.name()}`,
                payload,
            );
        }
    }

    private async decryptFrameData(frameData: FrameData): Promise<void> {
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

    private onDeviceTransportData(device: Device, buffer: Uint8Array): void {
        this.onDeviceTransportDataAsync(device, buffer)
            .then(() => {})
            .catch((err) => {
                this.logger.error(
                    'Failed to handle device transport data',
                    err,
                );
            });
    }

    private async onDeviceTransportDataAsync(
        device: Device,
        buffer: Uint8Array,
    ): Promise<void> {
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
            const totalPayload = this.messageAggregator.aggregate(frameData);
            if (totalPayload === undefined) {
                continue;
            }

            const serviceId = frameData.frameHeader.serviceId;
            const isControl = !!(
                frameData.frameHeader.flags & FrameHeaderFlags.CONTROL
            );

            const [messageId, payload] =
                this.messageCodec.decodeMessage(totalPayload);
            this.onReceiveMessage(serviceId, messageId, payload, isControl)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to handle received message', err);
                });
        }
    }

    private onDeviceTransportError(device: Device, err: Error): void {
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

    private onDeviceAvailable(device: Device): void {
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        this.callOnDevicesUpdated();
    }

    private onDeviceStateUpdated(): void {
        this.callOnDevicesUpdated();
    }

    private stopServices(i?: number): void {
        if (i === undefined) {
            i = this.services.length - 1;
        }

        this.logger.info('Stopping services');
        for (; i >= 0; i--) {
            const service = this.services[i];
            if (service === undefined) {
                break;
            }

            try {
                service.stop();
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

    private startServices(): void {
        this.logger.info('Starting services');
        let i = 0;
        try {
            for (; i < this.services.length; i++) {
                const service = this.services[i];
                if (service === undefined) {
                    break;
                }
                service.start();
            }
        } catch (err) {
            this.logger.error('Failed to start services', err);
            try {
                this.stopServices(i - 1);
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

    private startDependencies(): void {
        this.frameCodec.start();

        this.logger.info('Starting cryptor');
        try {
            this.cryptor.start();
        } catch (err) {
            this.logger.info('Failed to start cryptor');
            this.frameCodec.stop();
            throw err;
        }
        this.logger.info('Started cryptor');

        this.startServices();

        this.logger.info('Starting control service');
        try {
            this.controlService.start();
        } catch (err) {
            this.logger.error('Failed to start control service', err);
            try {
                this.stopServices();
                this.logger.info('Stopping cryptor');
                this.cryptor.stop();
                this.logger.info('Stopped cryptor');
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

    private stopDependencies(): void {
        this.logger.info('Stopping control service');
        try {
            this.controlService.stop();
            this.logger.info('Stopped control service');
        } catch (err) {
            this.logger.error('Failed to stop control service', err);
        }

        try {
            this.stopServices();
        } catch (err) {
            this.logger.error('Failed to stop services', err);
        }

        this.logger.info('Stopping cryptor');
        try {
            this.cryptor.stop();
            this.logger.info('Stopped cryptor');
        } catch (err) {
            this.logger.error('Failed to stop cryptor', err);
        }

        this.frameCodec.stop();
    }

    private onDeviceUnavailable(device: Device): void {
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);

        this.callOnDevicesUpdated();
    }

    protected async deviceSelfConnectionReject(device: Device): Promise<void> {
        try {
            await device.rejectSelfConnection();
        } catch (err) {
            this.logger.error(
                `Failed to reject device ${device.name} self connection`,
                err,
            );
        }
    }

    public connectDevice(device: Device): void {
        this.connectDeviceAsync(device).then(
            () => {},
            (err) => {
                this.logger.error('Failed to connect device', err);
            },
        );
    }

    public async connectDeviceAsync(device: Device): Promise<void> {
        if (
            this.connectedDevice !== undefined &&
            device.state === DeviceState.SELF_CONNECTING
        ) {
            this.logger.error(
                `Cannot accept self connection from ${device.name}, ` +
                    `${this.connectedDevice.name} already connected`,
            );

            await this.deviceSelfConnectionReject(device);
            return;
        }

        if (this.connectedDevice !== undefined) {
            await this.disconnectDeviceAsync(this.connectedDevice);
        }

        const release = await this.connectionLock.acquire();

        this.logger.info(`Connecting device ${device.name}`);
        try {
            await device.connect();
        } catch (err) {
            this.logger.error(`Failed to connect to ${device.name}`, err);
            release();
            return;
        }

        this.connectedDevice = device;
        this.onDeviceConnectedCallback(device);

        this.logger.info(`Connected device ${device.name}`);

        try {
            this.logger.info('Starting dependencies');
            this.startDependencies();
            this.logger.info('Started dependencies');
        } catch (err) {
            this.logger.error('Failed to start dependencies', err);
            await this.disconnectDeviceInternal(
                device,
                DeviceDisconnectReason.START_FAILED,
            );
        }

        try {
            await this.controlService.doStart();
        } catch (err) {
            this.logger.error('Failed to do control service start', err);
            await this.disconnectDeviceInternal(
                device,
                DeviceDisconnectReason.DO_START_FAILED,
            );
        }

        release();
    }

    public async disconnectDeviceInternal(
        device: Device,
        reason?: string,
    ): Promise<void> {
        this.logger.info(
            `Disconnecting device ${device.name} with reason ${reason}`,
        );

        if (reason !== DeviceDisconnectReason.START_FAILED) {
            this.logger.info('Stopping dependencies');
            try {
                this.stopDependencies();
                this.logger.info('Stopped dependencies');
            } catch (err) {
                this.logger.error('Failed to stop dependencies', err);
            }
        }

        try {
            await device.disconnect(reason);
        } catch (err) {
            this.logger.error(
                `Failed to disconnect device ${device.name}`,
                err,
            );
        }

        this.logger.info(`Disconnected device ${device.name}`);
        this.connectedDevice = undefined;
        this.onDeviceDisconnectedCallback();
    }

    public disconnectDevice(device: Device, reason?: string): void {
        this.disconnectDeviceAsync(device, reason)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to disconnect device', err);
            });
    }

    public async disconnectDeviceAsync(
        device: Device,
        reason?: string,
    ): Promise<void> {
        const release = await this.connectionLock.acquire();

        if (!this.isDeviceConnected(device)) {
            this.logger.info(
                `Cannot disconnect ${device.name}, ` +
                    'device is not the connected device',
            );
            release();
            return;
        }

        try {
            await this.disconnectDeviceInternal(device, reason);
        } catch (err) {
            this.logger.error('Failed to disconnect device', err);
        }

        release();
    }

    public getDeviceByName(name: string): Device | undefined {
        return this.nameDeviceMap.get(name);
    }

    public getConnectedDevice(): Device | undefined {
        return this.connectedDevice;
    }

    public async start(): Promise<void> {
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
        if (!this.started) {
            return;
        }

        this.logger.info('Server stopping');

        this.started = false;

        if (this.connectedDevice !== undefined) {
            await this.disconnectDeviceAsync(this.connectedDevice);
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
