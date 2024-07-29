import assert from 'node:assert';

import {
    Device,
    DeviceHandler,
    type DeviceHandlerConfig,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import Arpping from 'arpping';

import { TcpDevice } from './TcpDevice.js';

type Unpacked<T> = T extends (infer U)[] ? U : T;
type Host = Unpacked<Awaited<ReturnType<Arpping['discover']>>>;
type Interfaces = NonNullable<Arpping['interfaceFilters']['interface']>;

export interface TcpDeviceHandlerConfig extends DeviceHandlerConfig {
    scanOptions?: {
        interfaces: string[];
        mask: string;
        intervalMs: number;
    };
}

export class TcpDeviceHandler extends DeviceHandler<Host> {
    private scanBound: () => void;
    private scanInternval: ReturnType<typeof setInterval> | undefined;
    private arp;

    public constructor(
        protected override config: TcpDeviceHandlerConfig,
        events: DeviceHandlerEvents,
    ) {
        super(config, events);

        this.scanBound = this.scan.bind(this);

        if (this.config.scanOptions !== undefined) {
            this.arp = new Arpping({
                interfaceFilters: {
                    interface: this.config.scanOptions.interfaces as Interfaces,
                    internal: [false],
                    family: [],
                },
            });
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected override async createDevice(
        data: Host,
    ): Promise<Device | undefined> {
        return new TcpDevice(data.ip, data.mac, this.getDeviceEvents());
    }

    private updateDevices(hosts: Host[]): void {
        const newAvailableMacs = new Map<string, Host>();

        for (const host of hosts) {
            newAvailableMacs.set(host.mac, host);
        }

        for (const mac of this.deviceMap.keys()) {
            if (!newAvailableMacs.has(mac)) {
                this.removeDevice(mac);
            }
        }

        for (const [mac, host] of newAvailableMacs.entries()) {
            if (!this.deviceMap.has(mac)) {
                this.addDevice(host);
            }
        }
    }

    private scan(): void {
        assert(this.arp !== undefined);

        this.arp
            .discover()
            .then((hosts) => {
                this.updateDevices(hosts);
            })
            .catch((err) => {
                this.logger.error('Failed to get ARP table', err);
            });
    }

    private startScan(): void {
        if (this.config.scanOptions === undefined) {
            return;
        }

        assert(this.scanInternval === undefined);
        this.scanInternval = setInterval(
            this.scanBound,
            this.config.scanOptions.intervalMs,
        );
        this.scan();
    }

    private stopScan(): void {
        if (this.config.scanOptions === undefined) {
            return;
        }

        assert(this.scanInternval !== undefined);
        clearInterval(this.scanInternval);
        this.scanInternval = undefined;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async waitForDevices(): Promise<void> {
        this.startScan();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        this.stopScan();
    }
}
