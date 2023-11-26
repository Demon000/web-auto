import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import assert from 'node:assert';
import { microToMilli, milliTime, milliToMicro } from '@/utils/time';

export interface PingerEvents {
    onPingRequest: (request: PingRequest) => Promise<void>;
    onPingTimeout: () => Promise<void>;
}

export class Pinger {
    private pingTimeout?: NodeJS.Timeout;
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
        const isFirstPing =
            this.pingReceivedTime === undefined &&
            this.pingSentTime !== undefined;

        const isTimeoutPing =
            this.pingReceivedTime !== undefined &&
            this.pingSentTime !== undefined &&
            this.pingReceivedTime - this.pingSentTime > this.pingTimeoutMs;

        if (isFirstPing || isTimeoutPing) {
            await this.events.onPingTimeout();
            return;
        }

        this.pingTimeout = undefined;
        this.pingSentTime = milliTime();
        this.pingReceivedTime = undefined;

        const data = PingRequest.create({
            timestamp: milliToMicro(this.pingSentTime),
        });

        await this.events.onPingRequest(data);
        this.schedulePingTimeout();
    }

    public onPingResponse(data: PingResponse): void {
        this.pingReceivedTime = microToMilli(data.timestamp);
    }

    public start(): void {
        if (this.started) {
            return;
        }
        this.schedulePingTimeout();
        this.started = true;
    }

    public stop(): void {
        if (!this.started) {
            return;
        }
        this.cancelPing();
        this.started = false;
    }
}
