import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { getLogger } from '@web-auto/logging';
import { microsecondsTime, milliToMicro } from './../utils/time.js';

export interface PingerEvents {
    onPingRequest: (request: PingRequest) => Promise<void>;
    onPingTimeout: () => Promise<void>;
}

export class Pinger {
    protected logger = getLogger(this.constructor.name);
    private pingTimeout?: ReturnType<typeof setTimeout>;
    private pingReceivedTime?: bigint;
    private pingSentTime?: bigint;
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
        this.pingTimeout = setTimeout(this.onPingTimeout, 5000);
    }

    public cancelPing(): void {
        assert(this.pingTimeout !== undefined);
        clearTimeout(this.pingTimeout);
        this.pingTimeout = undefined;
    }

    public async onPingTimeout(): Promise<void> {
        const isTimeoutPing =
            this.pingReceivedTime !== undefined &&
            this.pingSentTime !== undefined &&
            this.pingReceivedTime - this.pingSentTime > this.pingTimeoutUs;

        if (isTimeoutPing) {
            try {
                await this.events.onPingTimeout();
            } catch (err) {
                this.logger.error('Failed to emit ping timeout event', err);
            }
            return;
        }

        this.pingTimeout = undefined;
        this.pingSentTime = microsecondsTime();
        this.pingReceivedTime = undefined;

        const data = new PingRequest({
            timestamp: this.pingSentTime,
        });

        try {
            await this.events.onPingRequest(data);
        } catch (err) {
            this.logger.error('Failed to emit ping request event', err);
        }

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
