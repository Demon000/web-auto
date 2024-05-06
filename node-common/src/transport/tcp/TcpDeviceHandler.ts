import {
    Device,
    DeviceHandler,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { TcpDevice } from './TcpDevice.js';
import assert from 'node:assert';
import Arpping from 'arpping';

type Unpacked<T> = T extends (infer U)[] ? U : T;
type Host = Unpacked<Awaited<ReturnType<Arpping['discover']>>>;
type Interfaces = NonNullable<Arpping['interfaceFilters']['interface']>;

export interface TcpDeviceHandlerConfig {
    ips?: string[];
    scanOptions?: {
        interfaces: string[];
        mask: string;
        intervalMs: number;
    };
}

export class TcpDeviceHandler extends DeviceHandler<string> {
    private scanBound: () => void;
    private scanInternval: ReturnType<typeof setInterval> | undefined;
    private arp;

    public constructor(
        private config: TcpDeviceHandlerConfig,
        ignoredDevices: string[] | undefined,
        events: DeviceHandlerEvents,
    ) {
        super(
            {
                ignoredDevices,
                selfConnectOnAvailable: false,
            },
            events,
        );

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
        data: string,
    ): Promise<Device | undefined> {
        return new TcpDevice(data, this.getDeviceEvents());
    }

    private updateDevices(hosts: Host[]): void {
        const newAvailableIps: string[] = [];

        for (const host of hosts) {
            newAvailableIps.push(host.ip);
        }

        const oldAvailableIps = Array.from(this.deviceMap.keys());

        for (const ip of oldAvailableIps) {
            if (
                !newAvailableIps.includes(ip) &&
                (this.config.ips === undefined || !this.config.ips.includes(ip))
            ) {
                this.removeDevice(ip);
            }
        }

        for (const ip of newAvailableIps) {
            if (!oldAvailableIps.includes(ip)) {
                this.addDevice(ip);
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
        if (this.config.ips !== undefined) {
            for (const ip of this.config.ips) {
                await this.addDeviceAsync(ip);
            }
        }

        this.startScan();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public override async stopWaitingForDevices(): Promise<void> {
        this.stopScan();
    }
}
