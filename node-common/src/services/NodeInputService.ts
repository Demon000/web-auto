import { InputService, type ServiceEvents } from '@web-auto/android-auto';
import {
    InputSourceService,
    InputSourceService_TouchScreen,
    KeyBindingRequest,
    KeyCode,
    KeyEvent,
    Service,
    TouchEvent,
    TouchScreenType,
} from '@web-auto/android-auto-proto';
import {
    stringToKeycode,
    stringToTouchscreenType,
    type ITouchEvent,
} from '@web-auto/android-auto-proto/interfaces.js';
import type { IpcServiceHandler } from '@web-auto/common-ipc/main.js';

export type AndroidAutoInputService = {
    sendTouchEvent: (touchEvent: ITouchEvent) => Promise<void>;
    sendKey: (keycode: string | KeyCode) => Promise<void>;
};

export type AndroidAutoInputClient = Record<string, never>;

export type NodeInputServiceConfig = {
    displayId: number;
    touchscreen?: {
        width: number;
        height: number;
        type: TouchScreenType | string;
    };
};

export class NodeInputService extends InputService {
    public constructor(
        private ipcHandler: IpcServiceHandler<
            AndroidAutoInputService,
            AndroidAutoInputClient
        >,
        private config: NodeInputServiceConfig,
        events: ServiceEvents,
    ) {
        super(events);

        this.ipcHandler.on(
            'sendTouchEvent',
            this.sendTouchEventObject.bind(this),
        );

        this.ipcHandler.on('sendKey', this.sendKey.bind(this));
    }

    public override destroy(): void {
        this.ipcHandler.off('sendKey');
    }

    protected async bind(_data: KeyBindingRequest): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/require-await
    private async sendTouchEventObject(data: ITouchEvent): Promise<void> {
        this.sendTouchEvent(new TouchEvent(data));
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    private async sendKey(keycode: string | KeyCode): Promise<void> {
        keycode = stringToKeycode(keycode);

        this.sendKeyEvent(
            new KeyEvent({
                keys: [
                    {
                        down: true,
                        keycode,
                        metastate: 0,
                    },
                    {
                        down: false,
                        keycode,
                        metastate: 0,
                    },
                ],
            }),
        );
    }

    protected fillKeycodes(inputSourceService: InputSourceService): void {
        for (const keyCode of Object.values(KeyCode)) {
            if (typeof keyCode === 'number') {
                inputSourceService.keycodesSupported.push(keyCode);
            }
        }
    }

    protected override fillChannelDescriptor(channelDescriptor: Service): void {
        channelDescriptor.inputSourceService = new InputSourceService({
            displayId: this.config.displayId,
        });

        if (this.config.touchscreen !== undefined) {
            channelDescriptor.inputSourceService.touchscreen.push(
                new InputSourceService_TouchScreen({
                    width: this.config.touchscreen.width,
                    height: this.config.touchscreen.height,
                    type: stringToTouchscreenType(this.config.touchscreen.type),
                    isSecondary: false,
                }),
            );
        }

        this.fillKeycodes(channelDescriptor.inputSourceService);
    }
}
