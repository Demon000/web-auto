import { Device, Endpoint, InEndpoint, OutEndpoint } from 'usb';

import { DataBuffer } from '@/utils/DataBuffer';
import { ITransport, TransportEvents } from '@/transport/ITransport';
import { TransportEvent } from '@/transport/ITransport';
import EventEmitter from 'eventemitter3';

const USB_TRANSPORT_SEND_TIMEOUT = 10000;

export class UsbTransport implements ITransport {
    public emitter = new EventEmitter<TransportEvents>();

    private inEndpoint: InEndpoint;
    private outEndpoint: OutEndpoint;

    public constructor(private device: Device) {
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
        let iface;
        try {
            if (this.inEndpoint.pollActive) {
                this.inEndpoint.stopPoll();
            }

            iface = this.device.interface(0);
            iface.release();
        } catch (e) {
            console.log(e);
        }
    }

    public async send(buffer: DataBuffer): Promise<void> {
        this.sendOrReceive(
            this.outEndpoint,
            buffer,
            USB_TRANSPORT_SEND_TIMEOUT,
        );
    }
}
