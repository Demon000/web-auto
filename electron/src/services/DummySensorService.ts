import { DummyDrivingStatusSensor } from '@/sensors/DummyDrivingStatusSensor';
import { DummyNightDataSensor } from '@/sensors/DummyNightDataSensor';
import { SensorService, ServiceEvents } from '@web-auto/android-auto';
import { ChannelOpenRequest } from '@web-auto/android-auto-proto';

export class DummySensorService extends SensorService {
    public constructor(events: ServiceEvents) {
        super(
            [new DummyDrivingStatusSensor(), new DummyNightDataSensor()],
            events,
        );
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }
}
