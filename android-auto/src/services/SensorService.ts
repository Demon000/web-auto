import {
    SensorMessageId,
    type Service as ProtoService,
    SensorSourceService_Sensor,
    SensorRequest,
    SensorType,
    SensorResponse,
    MessageStatus,
    SensorBatch,
    SensorSourceService,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';
import { Sensor, type SensorEvents } from '../sensors/Sensor.js';
import { Service, type ServiceEvents } from './Service.js';
import assert from 'node:assert';

export interface SensorsBuilder {
    buildSensors(events: SensorEvents): Sensor[];
}

export class SensorService extends Service {
    protected sensors: Sensor[];

    public constructor(builder: SensorsBuilder, events: ServiceEvents) {
        super(events);

        this.sensors = builder.buildSensors({
            onData: this.sendEventIndication.bind(this),
        });
    }

    protected findSensor(sensorType: SensorType): Sensor | undefined {
        for (const sensor of this.sensors) {
            if (sensor.type === sensorType) {
                return sensor;
            }
        }

        return undefined;
    }

    protected getSensor(sensorType: SensorType): Sensor {
        const sensor = this.findSensor(sensorType);
        if (sensor === undefined) {
            throw new Error(
                `Failed to get sensor with type ${sensorType.toString()}`,
            );
        }

        return sensor;
    }

    protected async onSensorStartRequest(data: SensorRequest): Promise<void> {
        try {
            assert(data.type !== undefined);
            const sensor = this.getSensor(data.type);
            sensor.start();
        } catch (err) {
            this.logger.error('Failed to start sensor', {
                data,
                err,
            });
            return;
        }

        return this.sendSensorStartResponse(data.type, true);
    }

    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as SensorMessageId) {
            case SensorMessageId.SENSOR_MESSAGE_REQUEST:
                data = SensorRequest.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onSensorStartRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async sendSensorStartResponse(
        sensorType: SensorType,
        status: boolean,
    ): Promise<void> {
        const data = new SensorResponse({
            status: status
                ? MessageStatus.STATUS_SUCCESS
                : MessageStatus.STATUS_INVALID_SENSOR,
        });

        await this.sendEncryptedSpecificMessage(
            SensorMessageId.SENSOR_MESSAGE_RESPONSE,
            data,
        );

        const sensor = this.getSensor(sensorType);
        await sensor.emit();
    }

    protected async sendEventIndication(data: SensorBatch): Promise<void> {
        return this.sendEncryptedSpecificMessage(
            SensorMessageId.SENSOR_MESSAGE_BATCH,
            data,
        );
    }

    protected fillChannelDescriptor(channelDescriptor: ProtoService): void {
        channelDescriptor.sensorSourceService = new SensorSourceService({
            sensors: [],
        });

        for (const sensor of this.sensors) {
            channelDescriptor.sensorSourceService.sensors.push(
                new SensorSourceService_Sensor({
                    sensorType: sensor.type,
                }),
            );
        }
    }

    public override stop(): void {
        super.stop();

        for (const sensor of this.sensors) {
            sensor.stop();
        }
    }
}
