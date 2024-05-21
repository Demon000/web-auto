import {
    DeviceHandler,
    type DeviceHandlerEvents,
} from './transport/DeviceHandler.js';
import { getLogger } from '@web-auto/logging';
import {
    Device,
    type DeviceDisconnectReason,
    GenericDeviceDisconnectReason,
    DeviceConnectReason,
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
        events: ControlServiceEvents,
    ): ControlService;

    buildServices(events: ServiceEvents): Service[];
}

export interface DeviceContext {
    cryptor: Cryptor;
    frameCodec: FrameCodec;
    messageCodec: MessageCodec;
    messageAggregator: MessageAggregator;
    services: Service[];
    controlService: ControlService;
    serviceIdServiceMap: Map<number, Service>;
}

export abstract class AndroidAutoServer {
    private logger = getLogger(this.constructor.name);
    private nameDeviceMap = new Map<string, Device>();
    private nameContextMap = new Map<string, DeviceContext>();

    private connectedDeviceContext: DeviceContext;
    private connectedDevice: Device | undefined;
    private started = false;

    private deviceHandlers: DeviceHandler[];
    private connectionLock = new Mutex();

    public constructor(private builder: AndroidAutoServerBuilder) {
        this.deviceHandlers = builder.buildDeviceHandlers({
            onDeviceNeedsProbe: this.onDeviceNeedsProbe.bind(this),
            onDeviceAdded: this.onDeviceAdded.bind(this),
            onDeviceSelfConnection: this.onDeviceSelfConnection.bind(this),
            onDeviceSelfDisconnection:
                this.onDeviceSelfDisconnection.bind(this),
            onDeviceStateUpdated: this.onDeviceStateUpdated.bind(this),
            onDeviceRemoved: this.onDeviceRemoved.bind(this),
            onDeviceTransportData: this.onDeviceTransportData.bind(this),
            onDeviceTransportError: this.onDeviceTransportError.bind(this),
        });

        this.connectedDeviceContext = this.buildDeviceContext(undefined, false);
    }

    private buildDeviceContext(
        device: Device | undefined,
        probe: boolean,
    ): DeviceContext {
        const cryptor = this.builder.buildCryptor(
            ANDROID_AUTO_CERTIFICATE,
            ANDROID_AUTO_PRIVATE_KEY,
        );

        const messageCodec = new MessageCodec();
        const frameCodec = new FrameCodec();
        const messageAggregator = new MessageAggregator();

        const getDevice = () => {
            let currentDevice = device;
            if (currentDevice === undefined) {
                currentDevice = this.connectedDevice;
            }

            return currentDevice;
        };

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;

        let services: Service[];
        if (probe) {
            services = [];
        } else {
            services = this.builder.buildServices({
                onProtoMessageSent(...args) {
                    const device = getDevice();
                    if (device === undefined) {
                        return;
                    }

                    return that.onSendProtoMessage.call(that, device, ...args);
                },
                onPayloadMessageSent(...args) {
                    const device = getDevice();
                    if (device === undefined) {
                        return;
                    }

                    return that.onSendPayloadMessage.call(
                        that,
                        device,
                        ...args,
                    );
                },
            });
        }

        const controlService = this.builder.buildControlService(cryptor, {
            onProtoMessageSent(...args) {
                const device = getDevice();
                if (device === undefined) {
                    return;
                }

                return that.onSendProtoMessage.call(that, device, ...args);
            },
            onPayloadMessageSent(...args) {
                const device = getDevice();
                if (device === undefined) {
                    return;
                }

                return that.onSendPayloadMessage.call(that, device, ...args);
            },
            onSelfDisconnect(...args) {
                const device = getDevice();
                if (device === undefined) {
                    return;
                }

                return that.onSelfDisconnect.call(that, device, ...args);
            },
            onUpdateRealName(...args) {
                const device = getDevice();
                if (device === undefined) {
                    return;
                }

                return that.onUpdateRealName.call(that, device, ...args);
            },
        });

        const serviceIdServiceMap = new Map<number, Service>();

        serviceIdServiceMap.set(controlService.serviceId, controlService);

        for (const service of services) {
            serviceIdServiceMap.set(service.serviceId, service);
        }

        return {
            controlService,
            cryptor,
            frameCodec,
            messageAggregator,
            messageCodec,
            serviceIdServiceMap,
            services,
        };
    }

    private createDeviceContext(device: Device, probe: boolean): DeviceContext {
        if (device === this.connectedDevice) {
            return this.connectedDeviceContext;
        }

        if (this.nameContextMap.has(device.name)) {
            throw new Error(`Context for device ${device.name} already exists`);
        }

        const context = this.buildDeviceContext(device, probe);
        this.nameContextMap.set(device.name, context);
        return context;
    }

    private getDeviceContext(device: Device): DeviceContext {
        if (device === this.connectedDevice) {
            return this.connectedDeviceContext;
        }

        const context = this.nameContextMap.get(device.name);
        if (context === undefined) {
            throw new Error(`Context for device ${device.name} does not exist`);
        }

        return context;
    }

    private destroyDeviceContext(device: Device): void {
        if (device === this.connectedDevice) {
            return;
        }

        if (!this.nameContextMap.has(device.name)) {
            throw new Error(`Context for device ${device.name} does not exist`);
        }

        this.nameContextMap.delete(device.name);
    }

    private async encryptFrameData(
        ctx: DeviceContext,
        frameData: FrameData,
    ): Promise<void> {
        const frameHeader = frameData.frameHeader;

        if (!(frameHeader.flags & FrameHeaderFlags.ENCRYPTED)) {
            return;
        }

        try {
            frameData.payload = await ctx.cryptor.encrypt(frameData.payload);
        } catch (err) {
            this.logger.error('Failed to encrypt', {
                frameData,
                err,
            });
            throw err;
        }
    }

    private async onSendFrameData(
        device: Device,
        ctx: DeviceContext,
        frameData: FrameData,
    ): Promise<void> {
        await this.encryptFrameData(ctx, frameData);

        const buffer = ctx.frameCodec.encodeFrameData(frameData);

        device.send(buffer);
    }

    private onSendMessage(
        device: Device,
        ctx: DeviceContext,
        serviceId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        const frameDatas = ctx.messageAggregator.split(
            serviceId,
            payload,
            isEncrypted,
            isControl,
        );

        for (const frameData of frameDatas) {
            this.onSendFrameData(device, ctx, frameData)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to send frame data', err);
                });
        }
    }

    private onSendPayloadMessage(
        device: Device,
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        const ctx = this.getDeviceContext(device);

        const totalPayload = ctx.messageCodec.encodePayload(messageId, payload);

        this.onSendMessage(
            device,
            ctx,
            serviceId,
            totalPayload,
            isEncrypted,
            isControl,
        );
    }
    private onSendProtoMessage(
        device: Device,
        serviceId: number,
        messageId: number,
        protoMessage: ProtoMessage,
        isEncrypted: boolean,
        isControl: boolean,
    ): void {
        const ctx = this.getDeviceContext(device);

        const totalPayload = ctx.messageCodec.encodeMessage(
            messageId,
            protoMessage,
        );

        this.onSendMessage(
            device,
            ctx,
            serviceId,
            totalPayload,
            isEncrypted,
            isControl,
        );
    }

    private onSelfDisconnect(
        device: Device,
        reason: DeviceDisconnectReason,
    ): void {
        if (reason === (GenericDeviceDisconnectReason.PING_TIMEOUT as string)) {
            this.logger.error(`Pinger timed out, disconnecting ${device.name}`);
        } else if (
            reason === (GenericDeviceDisconnectReason.BYE_BYE as string)
        ) {
            this.logger.error(
                `Self disconnect requested, disconnecting ${device.name}`,
            );
        }

        this.disconnectDeviceAsync(device, reason)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to handle self disconnect', err);
            });
    }

    private onUpdateRealName(device: Device, name: string): void {
        device.setRealName(name);
    }

    private async onReceiveMessage(
        ctx: DeviceContext,
        serviceId: number,
        messageId: number,
        payload: Uint8Array,
        isControl: boolean,
    ): Promise<void> {
        const service = ctx.serviceIdServiceMap.get(serviceId);
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

    private async decryptFrameData(
        ctx: DeviceContext,
        frameData: FrameData,
    ): Promise<void> {
        const frameHeader = frameData.frameHeader;

        if (!(frameHeader.flags & FrameHeaderFlags.ENCRYPTED)) {
            return;
        }

        try {
            frameData.payload = await ctx.cryptor.decrypt(frameData.payload);
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
        const ctx = this.getDeviceContext(device);

        const frameDatas = ctx.frameCodec.decodeBuffer(buffer);

        for (const frameData of frameDatas) {
            await this.decryptFrameData(ctx, frameData);
        }

        for (const frameData of frameDatas) {
            const totalPayload = ctx.messageAggregator.aggregate(frameData);
            if (totalPayload === undefined) {
                continue;
            }

            const serviceId = frameData.frameHeader.serviceId;
            const isControl = !!(
                frameData.frameHeader.flags & FrameHeaderFlags.CONTROL
            );

            const [messageId, payload] =
                ctx.messageCodec.decodeMessage(totalPayload);
            this.onReceiveMessage(ctx, serviceId, messageId, payload, isControl)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to handle received message', err);
                });
        }
    }

    private onDeviceTransportError(device: Device, err: Error): void {
        this.logger.error(`Received transport error from ${device.name}`, err);
    }

    protected abstract onDevicesUpdatedCallback(devices: Device[]): void;

    protected getDevices(): Device[] {
        return Array.from(this.nameDeviceMap.values());
    }

    private callOnDevicesUpdated(): void {
        const devices = this.getDevices();
        this.onDevicesUpdatedCallback(devices);
    }

    private async addDeviceAsync(device: Device): Promise<void> {
        const release = await this.connectionLock.acquire();
        this.nameDeviceMap.set(device.name, device);

        this.logger.info(`New available device ${device.name}`);

        this.callOnDevicesUpdated();
        release();
    }

    private onDeviceAdded(device: Device): void {
        this.addDeviceAsync(device)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to add device', err);
            });
    }

    private onDeviceStateUpdated(): void {
        this.callOnDevicesUpdated();
    }

    private stopServices(ctx: DeviceContext, i?: number): void {
        if (i === undefined) {
            i = ctx.services.length - 1;
        }

        this.logger.info('Stopping services');
        for (; i >= 0; i--) {
            const service = ctx.services[i];
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

    private startServices(ctx: DeviceContext): void {
        this.logger.info('Starting services');
        let i = 0;
        try {
            for (; i < ctx.services.length; i++) {
                const service = ctx.services[i];
                if (service === undefined) {
                    break;
                }
                service.start();
            }
        } catch (err) {
            this.logger.error('Failed to start services', err);
            try {
                this.stopServices(ctx, i - 1);
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

    private startDependencies(ctx: DeviceContext): void {
        ctx.frameCodec.start();
        ctx.messageAggregator.start();

        this.logger.info('Starting cryptor');
        try {
            ctx.cryptor.start();
        } catch (err) {
            this.logger.info('Failed to start cryptor');
            ctx.frameCodec.stop();
            ctx.messageAggregator.stop();
            throw err;
        }
        this.logger.info('Started cryptor');

        this.startServices(ctx);

        this.logger.info('Starting control service');
        try {
            ctx.controlService.start();
        } catch (err) {
            this.logger.error('Failed to start control service', err);
            try {
                this.stopServices(ctx);
                this.logger.info('Stopping cryptor');
                ctx.cryptor.stop();
                this.logger.info('Stopped cryptor');
                ctx.frameCodec.stop();
                ctx.messageAggregator.stop();
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

    private stopDependencies(ctx: DeviceContext): void {
        this.logger.info('Stopping dependencies');

        this.logger.info('Stopping control service');
        try {
            ctx.controlService.stop();
            this.logger.info('Stopped control service');
        } catch (err) {
            this.logger.error('Failed to stop control service', err);
        }

        try {
            this.stopServices(ctx);
        } catch (err) {
            this.logger.error('Failed to stop services', err);
        }

        this.logger.info('Stopping cryptor');
        try {
            ctx.cryptor.stop();
            this.logger.info('Stopped cryptor');
        } catch (err) {
            this.logger.error('Failed to stop cryptor', err);
        }

        ctx.frameCodec.stop();
        ctx.messageAggregator.stop();

        this.logger.info('Stopped dependencies');
    }

    private onDeviceRemoved(device: Device): void {
        this.removeDeviceAsync(device)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to remove device', err);
            });
    }

    private async removeDeviceAsync(device: Device): Promise<void> {
        const release = await this.connectionLock.acquire();
        this.logger.info(`Device ${device.name} no longer available`);

        this.nameDeviceMap.delete(device.name);

        this.callOnDevicesUpdated();
        release();
    }

    public onDeviceSelfConnection(device: Device): void {
        this.connectDeviceAsync(device, DeviceConnectReason.SELF_CONNECT).then(
            () => {},
            (err) => {
                this.logger.error('Failed to connect device', err);
            },
        );
    }

    public onDeviceNeedsProbe(device: Device): void {
        this.connectDeviceAsync(
            device,
            DeviceConnectReason.CONNECT_FOR_PROBE,
        ).then(
            () => {},
            (err) => {
                this.logger.error('Failed to connect device for probe', err);
            },
        );
    }

    public async connectDeviceAsyncLocked(
        device: Device,
        reason: DeviceConnectReason,
    ): Promise<void> {
        const probe = reason === DeviceConnectReason.CONNECT_FOR_PROBE;

        if (
            this.connectedDevice !== undefined &&
            reason === DeviceConnectReason.SELF_CONNECT
        ) {
            await this.disconnectDeviceAsyncLocked(
                device,
                GenericDeviceDisconnectReason.SELF_CONNECT_REFUSED,
            );
            return;
        }

        if (
            this.connectedDevice !== undefined &&
            reason === DeviceConnectReason.USER
        ) {
            await this.disconnectDeviceAsyncLocked(
                this.connectedDevice,
                GenericDeviceDisconnectReason.USER,
            );
        }

        if (probe) {
            this.logger.info(`Connecting device ${device.name} for probe`);
        } else {
            this.logger.info(`Connecting device ${device.name}`);
        }

        try {
            await device.connect(reason);
        } catch (err) {
            this.logger.error(`Failed to connect to ${device.name}`, err);
            return;
        }

        if (!probe) {
            this.connectedDevice = device;
        }

        const ctx = this.createDeviceContext(device, probe);

        this.logger.info(`Connected device ${device.name}`);

        try {
            this.logger.info('Starting dependencies');
            this.startDependencies(ctx);
            this.logger.info('Started dependencies');
        } catch (err) {
            this.logger.error('Failed to start dependencies', err);
            await this.disconnectDeviceAsyncLocked(
                device,
                GenericDeviceDisconnectReason.START_FAILED,
            );
            return;
        }

        if (probe) {
            try {
                await ctx.controlService.doProbe();
            } catch (err) {
                this.logger.error('Failed to do control service probe', err);
                await this.disconnectDeviceAsyncLocked(
                    device,
                    GenericDeviceDisconnectReason.PROBE_UNSUPPORTED,
                );
            }

            return;
        }

        try {
            await ctx.controlService.doStart(ctx.services);
        } catch (err) {
            this.logger.error('Failed to do control service start', err);
            await this.disconnectDeviceAsyncLocked(
                device,
                GenericDeviceDisconnectReason.DO_START_FAILED,
            );
        }
    }

    public async connectDeviceAsync(
        device: Device,
        reason: DeviceConnectReason,
    ): Promise<void> {
        const release = await this.connectionLock.acquire();
        await this.connectDeviceAsyncLocked(device, reason);
        release();
    }

    public async disconnectDeviceAsyncLocked(
        device: Device,
        reason: DeviceDisconnectReason,
    ): Promise<void> {
        const ctx = this.getDeviceContext(device);

        this.logger.info(
            `Disconnecting device ${device.name} with reason ${reason}`,
        );

        if (
            reason !== (GenericDeviceDisconnectReason.START_FAILED as string) &&
            reason !==
                (GenericDeviceDisconnectReason.SELF_CONNECT_REFUSED as string)
        ) {
            this.stopDependencies(ctx);
        }

        try {
            await device.disconnect(reason);
        } catch (err) {
            this.logger.error(
                `Failed to disconnect device ${device.name}`,
                err,
            );
        }

        this.destroyDeviceContext(device);

        this.logger.info(`Disconnected device ${device.name}`);

        if (this.connectedDevice === device) {
            this.connectedDevice = undefined;
        }
    }

    public onDeviceSelfDisconnection(
        device: Device,
        reason: DeviceDisconnectReason,
    ): void {
        this.disconnectDeviceAsync(device, reason)
            .then(() => {})
            .catch((err) => {
                this.logger.error('Failed to disconnect device', err);
            });
    }

    public async disconnectDeviceAsync(
        device: Device,
        reason: DeviceDisconnectReason,
    ): Promise<void> {
        const release = await this.connectionLock.acquire();

        try {
            await this.disconnectDeviceAsyncLocked(device, reason);
        } catch (err) {
            this.logger.error('Failed to disconnect device', err);
        }

        release();
    }

    public getDeviceByName(name: string): Device | undefined {
        return this.nameDeviceMap.get(name);
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
            await this.disconnectDeviceAsync(
                this.connectedDevice,
                GenericDeviceDisconnectReason.USER,
            );
        }

        for (const deviceHandler of this.deviceHandlers) {
            try {
                await deviceHandler.stopWaitingForDevices();
            } catch (err) {
                this.logger.error('Failed to stop waiting for devices', err);
            }
        }

        for (const ctx of this.nameContextMap.values()) {
            for (const service of ctx.services) {
                service.destroy();
            }
        }

        this.logger.info('Server stopped');
    }
}
