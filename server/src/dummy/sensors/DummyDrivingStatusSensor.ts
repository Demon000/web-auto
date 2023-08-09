import { Sensor, SensorEvent } from '@/sensors';
import {
    DrivingStatusNumber,
    SensorEventIndication,
    SensorType,
} from '@web-auto/protos/types';

export class DummyDrivingStatusSensor extends Sensor {
    public constructor() {
        super(SensorType.Enum.DRIVING_STATUS);
    }

    public async start(): Promise<void> {}

    public emit(): void {
        const data = SensorEventIndication.create({
            drivingStatus: [
                {
                    status: DrivingStatusNumber.Enum.UNRESTRICTED,
                },
            ],
        });
        this.emitter.emit(SensorEvent.DATA, data);
    }
}
