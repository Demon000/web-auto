import { Sensor, SensorEvents } from '@web-auto/android-auto';
import {
    DrivingStatusNumber,
    SensorEventIndication,
    SensorType,
} from '@web-auto/android-auto-proto';

export class DummyDrivingStatusSensor extends Sensor {
    public constructor(events: SensorEvents) {
        super(SensorType.Enum.DRIVING_STATUS, events);
    }

    public async emit(): Promise<void> {
        const data = SensorEventIndication.create({
            drivingStatus: [
                {
                    status: DrivingStatusNumber.Enum.UNRESTRICTED,
                },
            ],
        });

        await this.events.onData(data);
    }
}
