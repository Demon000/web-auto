import {
    SensorEventIndication,
    SensorType,
} from '@web-auto/android-auto-proto';

export interface SensorEvents {
    onData: (data: SensorEventIndication) => Promise<void>;
}

export abstract class Sensor {
    public constructor(
        public readonly type: SensorType.Enum,
        protected events: SensorEvents,
    ) {}

    public async start(): Promise<void> {}

    public async stop(): Promise<void> {}

    public abstract emit(): Promise<void>;
}
