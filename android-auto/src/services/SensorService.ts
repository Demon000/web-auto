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

import { Sensor } from '../sensors/Sensor.js';
import { Service, type ServiceEvents } from './Service.js';
import assert from 'node:assert';

export abstract class SensorService extends Service {
    protected abstract sensors: Sensor[];

    public constructor(events: ServiceEvents) {
        super(events);

        this.addMessageCallback(
            SensorMessageId.SENSOR_MESSAGE_REQUEST,
            this.onSensorStartRequest.bind(this),
            SensorRequest,
        );
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

    protected onSensorStartRequest(data: SensorRequest): void {
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

        this.sendSensorStartResponse(data.type, true);
    }

    protected sendSensorStartResponse(
        sensorType: SensorType,
        status: boolean,
    ): void {
        const data = new SensorResponse({
            status: status
                ? MessageStatus.STATUS_SUCCESS
                : MessageStatus.STATUS_INVALID_SENSOR,
        });

        this.sendEncryptedSpecificMessage(
            SensorMessageId.SENSOR_MESSAGE_RESPONSE,
            data,
        );

        const sensor = this.getSensor(sensorType);
        sensor.emit();
    }

    protected sendEventIndication(data: SensorBatch): void {
        this.sendEncryptedSpecificMessage(
            SensorMessageId.SENSOR_MESSAGE_BATCH,
            data,
        );
    }

    protected override fillChannelDescriptor(
        channelDescriptor: ProtoService,
    ): void {
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
