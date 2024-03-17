import type {
    Sensor,
    SensorEvents,
    SensorsBuilder,
} from '@web-auto/android-auto';
import {
    DummyNightDataSensor,
    type DummyNightDataSensorConfig,
} from '../sensors/DummyNightDataSensor.js';
import {
    DummyDrivingStatusSensor,
    type DummyDrivingStatusSensorConfig,
} from '../sensors/DummyDrivingStatusSensor.js';
import { assert } from 'typia';
import { getLogger } from '@web-auto/logging';

export type NodeSensorConfig = {
    name: string;
    config: any;
};

export class NodeSensorsBuilder implements SensorsBuilder {
    private logger = getLogger(this.constructor.name);

    public constructor(private sensorConfigs: NodeSensorConfig[]) {}

    private buildSensor(
        sensorConfig: NodeSensorConfig,
        events: SensorEvents,
    ): Sensor {
        switch (sensorConfig.name) {
            case DummyNightDataSensor.name: {
                const config =
                    sensorConfig.config as DummyNightDataSensorConfig;
                assert<DummyNightDataSensorConfig>(config);
                return new DummyNightDataSensor(config, events);
            }
            case DummyDrivingStatusSensor.name: {
                const config =
                    sensorConfig.config as DummyDrivingStatusSensorConfig;
                assert<DummyDrivingStatusSensorConfig>(config);
                return new DummyDrivingStatusSensor(config, events);
            }
            default:
                throw new Error(
                    `Invalid sensor with name ${sensorConfig.name}`,
                );
        }
    }

    public buildSensors(events: SensorEvents): Sensor[] {
        const sensors = [];

        for (const sensorConfig of this.sensorConfigs) {
            try {
                const sensor = this.buildSensor(sensorConfig, events);
                sensors.push(sensor);
            } catch (err) {
                this.logger.error('Failed to build sensor', err);
            }
        }

        return sensors;
    }
}
