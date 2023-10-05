import { ChannelId } from '@/messenger/ChannelId';
import { Message } from '@/messenger/Message';
import {
    AVChannelMessage,
    AVChannelSetupRequest,
    AVChannelSetupResponse,
    AVChannelSetupStatus,
} from '@web-auto/android-auto-proto';
import { DataBuffer } from '@/utils/DataBuffer';
import { Service } from './Service';

export abstract class AVService extends Service {
    protected session?: number;

    public constructor(channelId: ChannelId) {
        super(channelId);
    }

    protected async onSetupRequest(data: AVChannelSetupRequest): Promise<void> {
        let status = false;

        try {
            await this.setup(data);
            status = true;
        } catch (e) {
            console.log(e);
        }

        return this.sendSetupResponse(status);
    }

    public async onMessage(message: Message): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case AVChannelMessage.Enum.SETUP_REQUEST:
                data = AVChannelSetupRequest.decode(bufferPayload);
                this.printReceive(data);
                await this.onSetupRequest(data);
                break;
            default:
                await super.onMessage(message);
        }
    }

    protected abstract setup(data: AVChannelSetupRequest): Promise<void>;

    protected async sendSetupResponse(status: boolean): Promise<void> {
        const data = AVChannelSetupResponse.create({
            maxUnacked: 1,
            mediaStatus: status
                ? AVChannelSetupStatus.Enum.OK
                : AVChannelSetupStatus.Enum.FAIL,
            configs: [0],
        });
        this.printSend(data);

        const payload = DataBuffer.fromBuffer(
            AVChannelSetupResponse.encode(data).finish(),
        );

        await this.sendEncryptedSpecificMessage(
            AVChannelMessage.Enum.SETUP_RESPONSE,
            payload,
        );
    }
}
