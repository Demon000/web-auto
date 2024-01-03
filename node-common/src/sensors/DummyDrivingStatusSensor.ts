import { Sensor, type SensorEvents } from '@web-auto/android-auto';
import {
    DrivingStatus,
    SensorBatch,
    SensorType,
} from '@web-auto/android-auto-proto';

export interface DummyDrivingStatusSensorConfig {
    status: DrivingStatus;
}

export class DummyDrivingStatusSensor extends Sensor {
    public constructor(
        private config: DummyDrivingStatusSensorConfig,
        events: SensorEvents,
    ) {
        super(SensorType.SENSOR_DRIVING_STATUS_DATA, events);
    }

    public async emit(): Promise<void> {
        await this.events.onData(
            new SensorBatch({
                drivingStatusData: [
                    {
                        status: this.config.status,
                    },
                ],
            }),
        );
    }
}
