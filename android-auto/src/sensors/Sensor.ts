import { SensorBatch, SensorType } from '@web-auto/android-auto-proto';

export interface SensorEvents {
    onData: (data: SensorBatch) => Promise<void>;
}

export abstract class Sensor {
    public constructor(
        public readonly type: SensorType,
        protected events: SensorEvents,
    ) {}

    public start(): void {}

    public stop(): void {}

    public abstract emit(): Promise<void>;
}
