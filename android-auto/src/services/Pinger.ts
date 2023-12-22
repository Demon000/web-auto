import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { getLogger } from '@web-auto/logging';
import { microsecondsTime, milliToMicro } from './../utils/time.js';

export interface PingerEvents {
    onPingRequest: (request: PingRequest) => void;
    onPingTimeout: () => void;
}

export class Pinger {
    protected logger = getLogger(this.constructor.name);
    private pingTimeout: ReturnType<typeof setTimeout> | undefined;
    private pingReceivedTime: bigint | undefined;
    private pingSentTime: bigint | undefined;
    private started = false;
    private pingTimeoutUs: bigint;

    public constructor(
        pingTimeoutMs: number,
        private events: PingerEvents,
    ) {
        this.pingTimeoutUs = milliToMicro(pingTimeoutMs);
        this.onPingTimeout = this.onPingTimeout.bind(this);
    }

    public schedulePingTimeout(): void {
        assert(this.pingTimeout === undefined);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.pingTimeout = setTimeout(this.onPingTimeout, 5000);
    }

    public cancelPing(): void {
        assert(this.pingTimeout !== undefined);
        clearTimeout(this.pingTimeout);
        this.pingTimeout = undefined;
    }

    public onPingTimeout(): void {
        const isTimeoutPing =
            this.pingReceivedTime !== undefined &&
            this.pingSentTime !== undefined &&
            this.pingReceivedTime - this.pingSentTime > this.pingTimeoutUs;

        if (isTimeoutPing) {
            this.events.onPingTimeout();
            return;
        }

        this.pingTimeout = undefined;
        this.pingSentTime = microsecondsTime();
        this.pingReceivedTime = undefined;

        const data = new PingRequest({
            timestamp: this.pingSentTime,
        });

        this.events.onPingRequest(data);

        this.schedulePingTimeout();
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
