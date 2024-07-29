import assert from 'node:assert';

import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import { getLogger } from '@web-auto/logging';

import { microsecondsTime, milliToMicro } from './../utils/time.js';

export interface PingerEvents {
    onPingRequest: (request: PingRequest) => void;
    onPingTimeout: () => void;
}

export class Pinger {
    protected logger = getLogger(this.constructor.name);
    private pingInterval: ReturnType<typeof setInterval> | undefined;
    private pingReceivedTime: bigint | undefined;
    private pingSentTime: bigint | undefined;
    private started = false;
    private pingTimeoutUs: bigint;
    private onPingTimeoutBound: () => void;

    public constructor(
        pingTimeoutMs: number,
        private events: PingerEvents,
    ) {
        this.pingTimeoutUs = milliToMicro(pingTimeoutMs);
        this.onPingTimeoutBound = this.onPingTimeout.bind(this);
    }

    public schedulePingTimeout(): void {
        assert(this.pingInterval === undefined);
        this.pingInterval = setInterval(this.onPingTimeoutBound, 5000);
    }

    public cancelPing(): void {
        assert(this.pingInterval !== undefined);
        clearInterval(this.pingInterval);
        this.pingInterval = undefined;
    }

    public onPingTimeout(): void {
        const isTimeoutPing =
            this.pingSentTime !== undefined &&
            (this.pingReceivedTime === undefined ||
                this.pingReceivedTime - this.pingSentTime > this.pingTimeoutUs);

        if (isTimeoutPing) {
            this.events.onPingTimeout();
            return;
        }

        this.pingSentTime = microsecondsTime();
        this.pingReceivedTime = undefined;

        const data = new PingRequest({
            timestamp: this.pingSentTime,
        });

        this.events.onPingRequest(data);
    }

    public onPingResponse(data: PingResponse): void {
        this.pingReceivedTime = data.timestamp;
    }

    public start(): void {
        assert(!this.started);

        this.schedulePingTimeout();
        this.started = true;
    }

    public stop(): void {
        assert(this.started);

        this.cancelPing();
        this.pingReceivedTime = undefined;
        this.pingSentTime = undefined;
        this.started = false;
    }
}
