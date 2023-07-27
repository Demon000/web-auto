import { ChannelId } from './ChannelId';
import { EncryptionType } from './EncryptionType';
import { MessageType } from './MessageType';

export type MessageFrameOptions = {
    channelId: ChannelId;
    encryptionType: EncryptionType;
    messageType: MessageType;
};
