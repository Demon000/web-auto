import {
    ChannelDescriptor,
    ChannelOpenRequest,
    ISensor,
    SensorChannel,
    SensorChannelMessage,
    SensorEventIndication,
    SensorStartRequest,
    SensorStartResponse,
    SensorType,
    Status,
} from '@web-auto/android-auto-proto';

import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import { MessageFrameOptions } from '@/messenger/MessageFrameOptions';
import { MessageInStream } from '@/messenger/MessageInStream';
import { MessageOutStream } from '@/messenger/MessageOutStream';
import { Sensor, SensorEvent } from '@/sensors/Sensor';
import { DataBuffer } from '@/utils/DataBuffer';
import { Service } from './Service';

export class SensorService extends Service {
    public constructor(
        protected sensors: Sensor[],
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.SENSOR, messageInStream, messageOutStream);

        this.sendEventIndication = this.sendEventIndication.bind(this);
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

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async onSensorStartRequest(
        data: SensorStartRequest,
    ): Promise<void> {
        let status = false;

        try {
            const sensor = this.getSensor(data.sensorType);
            sensor.emitter.on(SensorEvent.DATA, this.sendEventIndication);
            await sensor.start();
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendSensorStartResponse(data.sensorType, status);
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case SensorChannelMessage.Enum.SENSOR_START_REQUEST:
                data = SensorStartRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onSensorStartRequest(data);
                break;
            default:
                await super.onMessage(message, options);
        }
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
        sensor.emit();
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
}
