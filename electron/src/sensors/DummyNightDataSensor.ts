import { Sensor, type SensorEvents } from '@web-auto/android-auto';
import {
    SensorEventIndication,
    SensorType,
} from '@web-auto/android-auto-proto';

export class DummyNightDataSensor extends Sensor {
    public constructor(events: SensorEvents) {
        super(SensorType.Enum.NIGHT_DATA, events);
    }

    public async emit(): Promise<void> {
        const data = SensorEventIndication.create({
            nightMode: [
                {
                    isNight: true,
                },
            ],
        });

        await this.events.onData(data);
    }
}
