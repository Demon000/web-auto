import {
    Config,
    Config_Status,
    MediaMessageId,
    Setup,
} from '@web-auto/android-auto-proto';
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

        this.sendSetupResponse(status);
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as MediaMessageId) {
            case MediaMessageId.MEDIA_MESSAGE_SETUP:
                data = Setup.fromBinary(payload);
                this.printReceive(data);
                await this.onSetupRequest(data);
                break;
            default:
                return super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    protected async setup(_data: Setup): Promise<void> {}
    protected afterSetup(): void {}

    protected getConfig(status: boolean): Config {
        return new Config({
            maxUnacked: 1,
            status: status ? Config_Status.READY : Config_Status.WAIT,
        });
    }

    protected sendSetupResponse(status: boolean): void {
        const data = this.getConfig(status);

        this.sendEncryptedSpecificMessage(
            MediaMessageId.MEDIA_MESSAGE_CONFIG,
            data,
        );

        if (!status) {
            return;
        }

        this.afterSetup();
    }
}
