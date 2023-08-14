import EventEmitter from 'eventemitter3';
import {
    SensorEventIndication,
    SensorType,
} from '@web-auto/android-auto-proto';

export enum SensorEvent {
    DATA,
}

export interface SensorEvents {
    [SensorEvent.DATA]: (data: SensorEventIndication) => void;
}

export abstract class Sensor {
    public emitter = new EventEmitter<SensorEvents>();

    public constructor(public readonly type: SensorType.Enum) {}

    public abstract start(): Promise<void>;

    public abstract emit(): void;
}
