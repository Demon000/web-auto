import { MessageInStream, MessageOutStream } from '@/messenger';
import { SensorService } from '@/services';
import { DummyDrivingStatusSensor, DummyNightDataSensor } from '@/dummy';

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
}
