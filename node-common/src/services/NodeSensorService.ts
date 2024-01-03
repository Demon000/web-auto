import { DummyDrivingStatusSensor } from '../sensors/DummyDrivingStatusSensor.js';
import { DummyNightDataSensor } from '../sensors/DummyNightDataSensor.js';
import {
    Sensor,
    type SensorEvents,
    SensorService,
} from '@web-auto/android-auto';

export class DummySensorService extends SensorService {
    protected override buildSensors(events: SensorEvents): Sensor[] {
        return [
            new DummyDrivingStatusSensor(events),
            new DummyNightDataSensor(events),
        ];
    }
}
