import {
    NavigationCurrentPosition,
    NavigationNextTurnDistanceEvent,
    NavigationNextTurnEvent,
    NavigationState,
    NavigationStatus,
    NavigationStatusMessageId,
} from '@web-auto/android-auto-proto';
import { Message } from '../messenger/Message.js';

import { Service, type ServiceEvents } from './Service.js';

export abstract class NavigationStatusService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected abstract handleStatus(data: NavigationStatus): Promise<void>;

    protected abstract handleDistance(
        data: NavigationNextTurnDistanceEvent,
    ): Promise<void>;

    protected abstract handleTurn(data: NavigationNextTurnEvent): Promise<void>;

    protected async onStatus(data: NavigationStatus): Promise<void> {
        await this.handleStatus(data);
    }

    protected async onDistance(
        data: NavigationNextTurnDistanceEvent,
    ): Promise<void> {
        await this.handleDistance(data);
    }

    protected async onTurn(data: NavigationNextTurnEvent): Promise<void> {
        await this.handleTurn(data);
    }

    protected abstract handleCurrentPosition(
        data: NavigationCurrentPosition,
    ): Promise<void>;

    protected async onCurrentPosition(
        data: NavigationCurrentPosition,
    ): Promise<void> {
        await this.handleCurrentPosition(data);
    }

    protected abstract handleState(data: NavigationState): Promise<void>;

    protected async onState(data: NavigationState): Promise<void> {
        await this.handleState(data);
    }

    public override async onSpecificMessage(
        message: Message,
    ): Promise<boolean> {
        const bufferPayload = message.getBufferPayload();
        let data;

        switch (message.messageId as NavigationStatusMessageId) {
            case NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_STATUS:
                data = NavigationStatus.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onStatus(data);
                break;
            case NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_DISTANCE_EVENT:
                data =
                    NavigationNextTurnDistanceEvent.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onDistance(data);
                break;
            case NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_TURN_EVENT:
                data = NavigationNextTurnEvent.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onTurn(data);
                break;
            case NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_STATE:
                data = NavigationState.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onState(data);
                break;
            case NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_CURRENT_POSITION:
                data = NavigationCurrentPosition.fromBinary(bufferPayload);
                this.printReceive(data);
                await this.onCurrentPosition(data);
                break;
            default:
                return super.onSpecificMessage(message);
        }

        return true;
    }
}
