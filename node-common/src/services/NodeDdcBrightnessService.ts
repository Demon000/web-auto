import {
    type Continuous,
    Display,
    DisplayManager,
    VCPFeatureCode,
    VcpValueType,
} from '@ddc-node/ddc-node';
import type { ServiceEvents } from '@web-auto/android-auto';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';
import assert from 'assert';

import {
    type AndroidAutoBrightnessClient,
    type AndroidAutoBrightnessService,
    NodeBrightnessService,
} from './NodeBrightnessService.js';

export type NodeDdcBrightnessServiceConfig = {
    serialNumber: string;
};

type LocalIpcHandler = IpcServiceHandler<
    AndroidAutoBrightnessService,
    AndroidAutoBrightnessClient
>;

export class NodeDdcBrightnessService extends NodeBrightnessService {
    private maxBrightness: number = 0;
    private display: Display | undefined;

    public constructor(
        private config: NodeDdcBrightnessServiceConfig,
        ipcHandler: LocalIpcHandler,
        events: ServiceEvents,
    ) {
        super(ipcHandler, events);
    }

    public override async init(): Promise<void> {
        const displayManager = new DisplayManager();
        const displays = await displayManager.collect();
        let foundDisplay;

        for (const display of displays) {
            if (display.serialNumber !== this.config.serialNumber) {
                continue;
            }

            foundDisplay = display;
            break;
        }

        if (foundDisplay === undefined) {
            throw new Error(
                'Failed to find display with serial number ' +
                    this.config.serialNumber,
            );
        }

        this.display = foundDisplay;

        await this.updateMaxBrightness();
    }

    protected async getBrightnessValue(): Promise<Continuous> {
        assert(this.display !== undefined);
        const value = await this.display.getVcpFeature(
            VCPFeatureCode.ImageAdjustment.Luminance,
        );
        assert(value.type == VcpValueType.Continuous);
        return value;
    }

    protected async updateMaxBrightness(): Promise<void> {
        const value = await this.getBrightnessValue();
        this.maxBrightness = value.maximumValue;
    }

    protected override async getBrightness(): Promise<number> {
        const value = await this.getBrightnessValue();
        return value.currentValue / value.maximumValue;
    }

    protected override async setBrightness(value: number): Promise<void> {
        assert(this.display !== undefined);
        await this.display.setVcpFeature(
            VCPFeatureCode.ImageAdjustment.Luminance,
            value * this.maxBrightness,
        );
    }
}
