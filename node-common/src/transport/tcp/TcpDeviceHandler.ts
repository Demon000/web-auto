import {
    Device,
    DeviceHandler,
    DeviceIndex,
    type DeviceHandlerEvents,
} from '@web-auto/android-auto';
import { TcpDevice } from './TcpDevice.js';
import assert from 'node:assert';
import Arpping from 'arpping';

type Unpacked<T> = T extends (infer U)[] ? U : T;
type Host = Unpacked<Awaited<ReturnType<Arpping['discover']>>>;
type Interfaces = NonNullable<Arpping['interfaceFilters']['interface']>;

export interface TcpDeviceHandlerConfig {
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
        private config: TcpDeviceHandlerConfig,
        ignoredDevices: string[] | undefined,
        index: DeviceIndex,
        events: DeviceHandlerEvents,
    ) {
        super(
            {
                ignoredDevices,
            },
            index,
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
        data: Host,
    ): Promise<Device | undefined> {
        return new TcpDevice(data.ip, data.mac, this.getDeviceEvents());
    }

    private scan(): void {
        assert(this.arp !== undefined);

        this.arp
            .discover()
            .then((hosts) => {
                const newAvailableMacs = new Map<string, Host>();

                for (const host of hosts) {
                    newAvailableMacs.set(host.mac, host);
                }

                this.updateDevices(newAvailableMacs);
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
