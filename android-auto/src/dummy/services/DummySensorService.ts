import { SensorService } from '@/services';
import { DummyDrivingStatusSensor, DummyNightDataSensor } from '@/dummy';
import { ChannelOpenRequest } from '@web-auto/android-auto-proto';

export class DummySensorService extends SensorService {
    public constructor() {
        super([new DummyDrivingStatusSensor(), new DummyNightDataSensor()]);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }
}
