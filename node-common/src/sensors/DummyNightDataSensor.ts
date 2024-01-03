import { Sensor, type SensorEvents } from '@web-auto/android-auto';
import { SensorBatch, SensorType } from '@web-auto/android-auto-proto';

export interface DummyNightDataSensorConfig {
    nightMode: boolean;
}

export class DummyNightDataSensor extends Sensor {
    public constructor(
        private config: DummyNightDataSensorConfig,
        events: SensorEvents,
    ) {
        super(SensorType.SENSOR_NIGHT_MODE, events);
    }

    public async emit(): Promise<void> {
        await this.events.onData(
            new SensorBatch({
                nightModeData: [
                    {
                        nightMode: this.config.nightMode,
                    },
                ],
            }),
        );
    }
}
