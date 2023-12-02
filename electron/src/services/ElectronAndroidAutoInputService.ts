import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    BindingRequest,
    ChannelDescriptor,
    InputChannel,
    type ITouchConfig,
    TouchConfig,
    type ITouchEvent,
} from '@web-auto/android-auto-proto';
import EventEmitter from 'eventemitter3';

export enum ElectronAndroidAutoInputServiceEvent {
    STOP = 'stop',
    TOUCH = 'touch',
}

export interface ElectronAndroidAutoInputServiceEvents {
    [ElectronAndroidAutoInputServiceEvent.STOP]: () => void;
    [ElectronAndroidAutoInputServiceEvent.TOUCH]: (data: ITouchEvent) => void;
}

export class ElectronAndroidAutoInputService extends InputService {
    public extraEmitter =
        new EventEmitter<ElectronAndroidAutoInputServiceEvents>();

    private touchScreenConfig: ITouchConfig;

    public constructor(touchScreenConfig: ITouchConfig, events: ServiceEvents) {
        super(events);

        this.touchScreenConfig = TouchConfig.fromObject(touchScreenConfig);

        this.extraEmitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            () => {},
        );
    }

    public async stop(): Promise<void> {
        await super.stop();
        this.extraEmitter.emit(ElectronAndroidAutoInputServiceEvent.STOP);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {}
    protected async bind(_data: BindingRequest): Promise<void> {}

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.inputChannel = InputChannel.create({
            supportedKeycodes: [],
            touchScreenConfig: this.touchScreenConfig,
        });
    }
}
