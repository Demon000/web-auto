import {
    ChannelDescriptor,
    type ISensor,
    SensorChannel,
    SensorChannelMessage,
    SensorEventIndication,
    SensorStartRequest,
    SensorStartResponse,
    SensorType,
    Status,
} from '@web-auto/android-auto-proto';

import { Message } from '../messenger/Message.js';
import { Sensor, type SensorEvents } from '../sensors/Sensor.js';
import { DataBuffer } from '../utils/DataBuffer.js';
import { Service, type ServiceEvents } from './Service.js';

export abstract class SensorService extends Service {
    protected sensors: Sensor[];
    public constructor(protected events: ServiceEvents) {
        super(events);

        this.sendEventIndication = this.sendEventIndication.bind(this);

        this.sensors = this.buildSensors({
            onData: this.sendEventIndication,
        });
    }

    protected buildSensors(_events: SensorEvents): Sensor[] {
        return [];
    }

    protected findSensor(sensorType: SensorType.Enum): Sensor | undefined {
        for (const sensor of this.sensors) {
            if (sensor.type === sensorType) {
                return sensor;
            }
        }

        return undefined;
    }

    protected getSensor(sensorType: SensorType.Enum): Sensor {
        const sensor = this.findSensor(sensorType);
        if (sensor === undefined) {
            throw new Error(
                `Failed to get sensor with type ${sensorType.toString()}`,
            );
        }

        return sensor;
    }

    protected async onSensorStartRequest(
        data: SensorStartRequest,
    ): Promise<void> {
        try {
            const sensor = this.getSensor(data.sensorType);
            await sensor.start();
        } catch (err) {
            this.logger.error('Failed to start sensor', {
                metadata: {
                    data,
                    err,
                },
            });
            return;
        }

        return this.sendSensorStartResponse(data.sensorType, true);
    }

    public async onSpecificMessage(message: Message): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case SensorChannelMessage.Enum.SENSOR_START_REQUEST:
                data = SensorStartRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onSensorStartRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async sendSensorStartResponse(
        sensorType: SensorType.Enum,
        status: boolean,
    ): Promise<void> {
        const data = SensorStartResponse.create({
            status: status ? Status.Enum.OK : Status.Enum.FAIL,
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            SensorStartResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            SensorChannelMessage.Enum.SENSOR_START_RESPONSE,
            payload,
        );

        const sensor = this.getSensor(sensorType);
        await sensor.emit();
    }

    protected async sendEventIndication(
        data: SensorEventIndication,
    ): Promise<void> {
        const payload = DataBuffer.fromBuffer(
            SensorEventIndication.encode(data).finish(),
        );

        return this.sendEncryptedSpecificMessage(
            SensorChannelMessage.Enum.SENSOR_EVENT_INDICATION,
            payload,
        );
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        const sensors: ISensor[] = [];

        for (const sensor of this.sensors) {
            sensors.push({
                type: sensor.type,
            });
        }

        channelDescriptor.sensorChannel = SensorChannel.create({
            sensors,
        });
    }

    public async stop(): Promise<void> {
        await super.stop();

        for (const sensor of this.sensors) {
            await sensor.stop();
        }
    }
}
