import { ChannelId } from '../messenger/ChannelId';
import { Message } from '../messenger/Message';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { SensorStartResponse, Status } from '../proto/types';
import { SensorChannel } from '../proto/types';
import { SensorEventIndication } from '../proto/types';
import { DrivingStatusNumber } from '../proto/types';
import { SensorStartRequest } from '../proto/types';
import { SensorChannelMessage } from '../proto/types';
import {
    ChannelOpenRequest,
    ChannelDescriptor,
    SensorType,
} from '../proto/types';
import { DataBuffer } from '../utils/DataBuffer';
import { Service } from './Service';

export class SensorService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.SENSOR, messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async sensorStart(_sensorType: SensorType.Enum): Promise<void> {
        // TODO
    }

    protected async onSensorStartRequest(
        data: SensorStartRequest,
    ): Promise<void> {
        let status = false;

        try {
            await this.sensorStart(data.sensorType);
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

        if (status) {
            if (sensorType === SensorType.Enum.NIGHT_DATA) {
                await this.sendNightData();
            } else if (sensorType === SensorType.Enum.DRIVING_STATUS) {
                await this.sendDrivingStatus();
            }
        }
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

    protected async sendNightData(): Promise<void> {
        const data = SensorEventIndication.create({
            nightMode: [
                {
                    isNight: true,
                },
            ],
        });
        this.printSend(data);

        await this.sendEventIndication(data);
    }

    protected async sendDrivingStatus(): Promise<void> {
        const data = SensorEventIndication.create({
            drivingStatus: [
                {
                    status: DrivingStatusNumber.Enum.UNRESTRICTED,
                },
            ],
        });
        this.printSend(data);

        await this.sendEventIndication(data);
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.sensorChannel = SensorChannel.create({
            sensors: [
                {
                    type: SensorType.Enum.DRIVING_STATUS,
                },
                {
                    type: SensorType.Enum.NIGHT_DATA,
                },
            ],
        });
    }
}
