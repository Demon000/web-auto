import {
    SensorService,
    type Sensor,
    type SensorEvents,
    type ServiceEvents,
} from '@web-auto/android-auto';
import {
    DummyNightDataSensor,
    type DummyNightDataSensorConfig,
} from '../sensors/DummyNightDataSensor.js';
import {
    DummyDrivingStatusSensor,
    type DummyDrivingStatusSensorConfig,
} from '../sensors/DummyDrivingStatusSensor.js';

export type NodeSensorConfig =
    | ({
          name: 'DummyNightDataSensor';
      } & DummyNightDataSensorConfig)
    | ({
          name: 'DummyDrivingStatusSensor';
      } & DummyDrivingStatusSensorConfig);

export type NodeSensorServiceConfig = {
    sensors: NodeSensorConfig[];
};

export class NodeSensorService extends SensorService {
    protected override sensors: Sensor[] = [];

    public constructor(
        private config: NodeSensorServiceConfig,
        events: ServiceEvents,
    ) {
        super(events);

        for (const sensorConfig of this.config.sensors) {
            try {
                const sensor = this.buildSensor(sensorConfig, {
                    onData: this.sendEventIndication.bind(this),
                });

                this.sensors.push(sensor);
            } catch (err) {
                this.logger.error('Failed to build sensor', err);
            }
        }
    }

    private buildSensor(entry: NodeSensorConfig, events: SensorEvents): Sensor {
        switch (entry.name) {
            case 'DummyNightDataSensor':
                return new DummyNightDataSensor(entry, events);
            case 'DummyDrivingStatusSensor':
                return new DummyDrivingStatusSensor(entry, events);
        }
    }
}
