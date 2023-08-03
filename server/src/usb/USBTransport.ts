import { DataBuffer } from '../utils/DataBuffer';
import {
    ITransport,
    TransportEvent,
    TransportEvents,
} from '../transport/ITransport';
import { Device, Endpoint, InEndpoint, OutEndpoint } from 'usb';
import EventEmitter from 'eventemitter3';

const USB_TRANSPORT_SEND_TIMEOUT = 10000;

export class UsbTransport implements ITransport {
    public emitter = new EventEmitter<TransportEvents>();

    private inEndpoint: InEndpoint;
    private outEndpoint: OutEndpoint;

    public constructor(device: Device) {
        const iface = device.interface(0);

        iface.claim();

        let inEndpoint: InEndpoint | undefined;
        let outEndpoint: OutEndpoint | undefined;
        for (const endpoint of iface.endpoints) {
            if (endpoint.direction == 'in') {
                inEndpoint = endpoint as InEndpoint;
            }

            if (endpoint.direction == 'out') {
                outEndpoint = endpoint as OutEndpoint;
            }

            if (inEndpoint && outEndpoint) {
                break;
            }
        }

        if (!inEndpoint || !outEndpoint) {
            throw new Error('Failed to find endpoints');
        }

        this.inEndpoint = inEndpoint;
        this.inEndpoint.addListener('data', (data: Buffer) => {
            const buffer = DataBuffer.fromBuffer(data);
            this.emitter.emit(TransportEvent.DATA, buffer);
        });
        this.inEndpoint.addListener('error', (err: Error) => {
            this.emitter.emit(TransportEvent.ERROR, err);
        });
        this.outEndpoint = outEndpoint;
    }

    private async sendOrReceive(
        endpoint: Endpoint,
        buffer: DataBuffer,
        timeout: number,
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            const transfer = endpoint.makeTransfer(
                timeout,
                (error, _data, length) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(length);
                },
            );

            transfer.submit(buffer.data);
        });
    }

    public init(): void {
        this.inEndpoint.startPoll();
    }

    public deinit(): void {
        if (this.inEndpoint.pollActive) {
            this.inEndpoint.stopPoll();
        }
    }

    public async send(buffer: DataBuffer): Promise<void> {
        const timeout = USB_TRANSPORT_SEND_TIMEOUT;

        await this.sendOrReceive(this.outEndpoint, buffer, timeout);
    }
}
