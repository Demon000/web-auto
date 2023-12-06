import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { microToMilli, milliTime, milliToMicro } from '../utils/time.js';
import { getLogger } from '@web-auto/logging';
import Long from 'long';

export interface PingerEvents {
    onPingRequest: (request: PingRequest) => Promise<void>;
    onPingTimeout: () => Promise<void>;
}

export class Pinger {
    protected logger = getLogger(this.constructor.name);
    private pingTimeout?: ReturnType<typeof setTimeout>;
    private pingReceivedTime?: number;
    private pingSentTime?: number;
    private started = false;

    public constructor(
        private pingTimeoutMs: number,
        private events: PingerEvents,
    ) {
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
            this.pingReceivedTime - this.pingSentTime > this.pingTimeoutMs;

        if (isTimeoutPing) {
            try {
                await this.events.onPingTimeout();
            } catch (err) {
                this.logger.error('Failed to emit ping timeout event', err);
            }
            return;
        }

        this.pingTimeout = undefined;
        this.pingSentTime = milliTime();
        this.pingReceivedTime = undefined;

        const data = PingRequest.create({
            timestamp: milliToMicro(this.pingSentTime),
        });

        try {
            await this.events.onPingRequest(data);
        } catch (err) {
            this.logger.error('Failed to emit ping request event', err);
        }

        this.schedulePingTimeout();
    }

    public onPingResponse(data: PingResponse): void {
        assert(Long.isLong(data.timestamp));
        this.pingReceivedTime = microToMilli(data.timestamp);
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
