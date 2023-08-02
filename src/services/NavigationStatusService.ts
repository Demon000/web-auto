import {
    ChannelDescriptor,
    ChannelOpenRequest,
    NavigationTurnType,
} from '../proto/types';
import { Service } from './Service';
import { MessageFrameOptions } from '../messenger/MessageFrameOptions';
import { Message } from '../messenger/Message';
import { MessageInStream } from '../messenger/MessageInStream';
import { MessageOutStream } from '../messenger/MessageOutStream';
import { ChannelId } from '../messenger/ChannelId';
import { NavigationChannelMessage } from '../proto/types';
import { NavigationStatus } from '../proto/types';
import { NavigationDistanceEvent } from '../proto/types';
import { NavigationTurnEvent } from '../proto/types';

export class NavigationStatusService extends Service {
    public constructor(
        messageInStream: MessageInStream,
        messageOutStream: MessageOutStream,
    ) {
        super(ChannelId.NAVIGATION, messageInStream, messageOutStream);
    }

    protected async open(_data: ChannelOpenRequest): Promise<void> {
        // TODO
    }

    protected async onStatus(_data: NavigationStatus): Promise<void> {
        // TODO
    }

    protected async onDistance(_data: NavigationDistanceEvent): Promise<void> {
        // TODO
    }

    protected async onTurn(_data: NavigationTurnEvent): Promise<void> {
        // TODO
    }

    protected async onMessage(
        message: Message,
        options: MessageFrameOptions,
    ): Promise<void> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId) {
            case NavigationChannelMessage.Enum.STATUS:
                data = NavigationStatus.decode(bufferPayload);
                this.printReceive(data);
                await this.onStatus(data);
                break;
            case NavigationChannelMessage.Enum.DISTANCE_EVENT:
                data = NavigationDistanceEvent.decode(bufferPayload);
                this.printReceive(data);
                await this.onDistance(data);
                break;
            case NavigationChannelMessage.Enum.TURN_EVENT:
                data = NavigationTurnEvent.decode(bufferPayload);
                this.printReceive(data);
                await this.onTurn(data);
                break;
            default:
                await super.onMessage(message, options);
        }
    }

    protected fillChannelDescriptor(
        channelDescriptor: ChannelDescriptor,
    ): void {
        channelDescriptor.navigationChannel = {
            minimumIntervalMs: 1000,
            type: NavigationTurnType.Enum.IMAGE,
            imageOptions: {
                width: 256,
                height: 256,
                colourDepthBits: 16,
                dunno: 256,
            },
        };
    }
}
