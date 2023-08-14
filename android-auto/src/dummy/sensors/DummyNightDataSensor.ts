import { Sensor, SensorEvent } from '@/sensors';
import {
    SensorEventIndication,
    SensorType,
} from '@web-auto/android-auto-proto';

export class DummyNightDataSensor extends Sensor {
    public constructor() {
        super(SensorType.Enum.NIGHT_DATA);
    }

    public async start(): Promise<void> {}

    public emit(): void {
        const data = SensorEventIndication.create({
            nightMode: [
                {
                    isNight: true,
                },
            ],
        });
        this.emitter.emit(SensorEvent.DATA, data);
    }
}
