import { PingRequest, PingResponse } from '@web-auto/android-auto-proto';
import EventEmitter from 'eventemitter3';
import assert from 'node:assert';
import { microToMilli, milliTime, milliToMicro } from '@/utils/time';

export enum PingerEvent {
    PING_REQUEST = 'ping-request',
    PING_TIMEOUT = 'ping-timeout',
}

export interface PingerEvents {
    [PingerEvent.PING_REQUEST]: (request: PingRequest) => void;
    [PingerEvent.PING_TIMEOUT]: () => void;
}

export class Pinger {
    public emitter = new EventEmitter<PingerEvents>();

    private pingTimeout?: NodeJS.Timeout;
    private pingReceivedTime?: number;
    private pingSentTime?: number;
    private started = false;

    public constructor(private pingTimeoutMs: number) {
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
            this.emitter.emit(PingerEvent.PING_TIMEOUT);
            return;
        }

        this.pingTimeout = undefined;
        this.pingSentTime = milliTime();
        this.pingReceivedTime = undefined;

        const data = PingRequest.create({
            timestamp: milliToMicro(this.pingSentTime),
        });

        this.emitter.emit(PingerEvent.PING_REQUEST, data);
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
