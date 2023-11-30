import { DummyDrivingStatusSensor } from '@/sensors/DummyDrivingStatusSensor';
import { DummyNightDataSensor } from '@/sensors/DummyNightDataSensor';
import { Sensor, SensorEvents, SensorService } from '@web-auto/android-auto';
import { ChannelOpenRequest } from '@web-auto/android-auto-proto';

export class DummySensorService extends SensorService {
    protected buildSensors(events: SensorEvents): Sensor[] {
        return [
            new DummyDrivingStatusSensor(events),
            new DummyNightDataSensor(events),
        ];
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }
}
