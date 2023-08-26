import { MessageInStream, MessageOutStream } from '@/messenger';
import { SensorService } from '@/services';
import { DummyDrivingStatusSensor, DummyNightDataSensor } from '@/dummy';
import { ChannelOpenRequest } from '@web-auto/android-auto-proto';

export class DummySensorService extends SensorService {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(
            [new DummyDrivingStatusSensor(), new DummyNightDataSensor()],
            messageInStream,
            messageOutStream,
        );
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }
}
