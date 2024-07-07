import { Service, type ServiceEvents } from '@web-auto/android-auto';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export type AndroidAutoBrightnessClient = Record<string, never>;

export type AndroidAutoBrightnessService = {
    setBrightness: (brightness: number) => Promise<void>;
    getBrightness: () => Promise<number>;
};

export abstract class NodeBrightnessService extends Service {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoBrightnessService,
            AndroidAutoBrightnessClient
        >,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on('getBrightness', this.getBrightness.bind(this));
        this.ipcHandler.on('setBrightness', this.setBrightness.bind(this));
    }

    public override destroy(): void {
        this.ipcHandler.off('getBrightness');
        this.ipcHandler.off('setBrightness');
    }

    protected abstract getBrightness(): Promise<number>;
    protected abstract setBrightness(value: number): Promise<void>;
}
