import { InputService } from '@web-auto/android-auto';
import {
    ChannelOpenRequest,
    BindingRequest,
    ChannelDescriptor,
    InputChannel,
    ITouchConfig,
    TouchConfig,
    ITouchEvent,
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

    public constructor(touchScreenConfig: ITouchConfig) {
        super();

        this.touchScreenConfig = TouchConfig.fromObject(touchScreenConfig);

        this.extraEmitter.on(
            ElectronAndroidAutoInputServiceEvent.TOUCH,
            () => {},
        );
    }

    public stop(): void {
        super.stop();
        this.extraEmitter.emit(ElectronAndroidAutoInputServiceEvent.STOP);
        this.extraEmitter.removeAllListeners();
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