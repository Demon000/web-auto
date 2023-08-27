import {
    InputService,
    MessageInStream,
    MessageOutStream,
} from '@web-auto/android-auto';
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
    public emitter = new EventEmitter<ElectronAndroidAutoInputServiceEvents>();

    private touchScreenConfig: ITouchConfig;

    public constructor(
        touchScreenConfig: ITouchConfig,
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(messageInStream, messageOutStream);

        this.touchScreenConfig = TouchConfig.fromObject(touchScreenConfig);

        this.emitter.on(ElectronAndroidAutoInputServiceEvent.TOUCH, () => {});
    }

    public stop(): void {
        this.emitter.emit(ElectronAndroidAutoInputServiceEvent.STOP);
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
