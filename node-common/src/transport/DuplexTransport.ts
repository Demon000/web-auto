import { Duplex } from 'node:stream';

export interface DuplexTransportEvents {
    onData: (data: Uint8Array) => void;
    onError: (err: Error) => void;
    onDisconnected: () => void;
}

export class DuplexTransport {
    private onDataBound: (data: Uint8Array) => void;
    private onErrorBound: (err: Error) => void;
    private onCloseBound: () => void;

    public constructor(
        private socket: Duplex,
        private events: DuplexTransportEvents,
    ) {
        this.onDataBound = this.onData.bind(this);
        this.onErrorBound = this.onError.bind(this);
        this.onCloseBound = this.onClose.bind(this);

        this.attachEvents();
    }

    private onData(data: Uint8Array): void {
        this.events.onData(data);
    }

    private onError(err: Error): void {
        this.events.onError(err);
    }

    private detachEvents(): void {
        this.socket.off('error', this.onErrorBound);
        this.socket.off('data', this.onDataBound);
        this.socket.off('close', this.onCloseBound);
    }

    private attachEvents(): void {
        this.socket.on('data', this.onDataBound);
        this.socket.on('error', this.onErrorBound);
        this.socket.on('close', this.onCloseBound);
    }

    private onClose(): void {
        this.detachEvents();

        this.events.onDisconnected();
    }

    public disconnect(): void {
        this.detachEvents();

        this.socket.destroy();
    }

    public send(buffer: Uint8Array): void {
        this.socket.write(buffer);
    }
}
