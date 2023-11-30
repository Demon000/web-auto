import {
    NavigationChannelMessage,
    NavigationDistanceEvent,
    NavigationStatus,
    NavigationTurnEvent,
} from '@web-auto/android-auto-proto';

import { Message } from '@/messenger/Message';

import { Service, ServiceEvents } from './Service';

export abstract class NavigationStatusService extends Service {
    public constructor(protected events: ServiceEvents) {
        super(events);
    }

    protected abstract handleStatus(data: NavigationStatus): Promise<void>;

    protected abstract handleDistance(
        data: NavigationDistanceEvent,
    ): Promise<void>;

    protected abstract handleTurn(data: NavigationTurnEvent): Promise<void>;

    protected async onStatus(data: NavigationStatus): Promise<void> {
        await this.handleStatus(data);
    }

    protected async onDistance(data: NavigationDistanceEvent): Promise<void> {
        await this.handleDistance(data);
    }

    protected async onTurn(data: NavigationTurnEvent): Promise<void> {
        await this.handleTurn(data);
    }

    public async onSpecificMessage(message: Message): Promise<boolean> {
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
                return super.onSpecificMessage(message);
        }

        return true;
    }
}
