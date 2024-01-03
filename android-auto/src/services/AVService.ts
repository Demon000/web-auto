import {
    Config,
    Config_Status,
    MediaMessageId,
    Setup,
} from '@web-auto/android-auto-proto';
import { Message } from '../messenger/Message.js';
import { Service, type ServiceEvents } from './Service.js';

export abstract class AVService extends Service {
    protected session: number | undefined;

    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected async onSetupRequest(data: Setup): Promise<void> {
        let status = false;

        try {
            await this.setup(data);
            status = true;
        } catch (err) {
            this.logger.error('Failed to setup', {
                data,
                err,
            });
            return;
        }

        return this.sendSetupResponse(status);
    }

    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_SETUP:
                data = Setup.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onSetupRequest(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }

    protected async setup(_data: Setup): Promise<void> {}
    protected async afterSetup(): Promise<void> {}

    protected async sendSetupResponse(status: boolean): Promise<void> {
        const data = new Config({
            maxUnacked: 1,
            status: status ? Config_Status.READY : Config_Status.WAIT,
            configurationIndices: [0],
        });

        await this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_CONFIG,
            data,
        );

        if (!status) {
            return;
        }

        await this.afterSetup();
    }
}
