import {
    NavigationCurrentPosition,
    NavigationNextTurnDistanceEvent,
    NavigationNextTurnEvent,
    NavigationState,
    NavigationStatus,
    NavigationStatusMessageId,
} from '@web-auto/android-auto-proto';

import { Service, type ServiceEvents } from './Service.js';

export abstract class NavigationStatusService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);

        this.addMessageCallback(
            NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_STATUS,
            this.onStatus.bind(this),
            NavigationStatus,
        );
        this.addMessageCallback(
            NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_DISTANCE_EVENT,
            this.onDistance.bind(this),
            NavigationNextTurnDistanceEvent,
        );
        this.addMessageCallback(
            NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_TURN_EVENT,
            this.onTurn.bind(this),
            NavigationNextTurnEvent,
        );
        this.addMessageCallback(
            NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_STATE,
            this.onState.bind(this),
            NavigationState,
        );
        this.addMessageCallback(
            NavigationStatusMessageId.INSTRUMENT_CLUSTER_NAVIGATION_CURRENT_POSITION,
            this.onCurrentPosition.bind(this),
            NavigationCurrentPosition,
        );
    }

    protected abstract handleStatus(data: NavigationStatus): Promise<void>;

    protected abstract handleDistance(
        data: NavigationNextTurnDistanceEvent,
    ): Promise<void>;

    protected abstract handleTurn(data: NavigationNextTurnEvent): Promise<void>;

    protected abstract handleCurrentPosition(
        data: NavigationCurrentPosition,
    ): Promise<void>;

    protected abstract handleState(data: NavigationState): Promise<void>;

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

    protected async onCurrentPosition(
        data: NavigationCurrentPosition,
    ): Promise<void> {
        await this.handleCurrentPosition(data);
    }

    protected async onState(data: NavigationState): Promise<void> {
        await this.handleState(data);
    }
}
