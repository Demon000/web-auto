import { DataBuffer } from '../utils/DataBuffer';
import { Device, Endpoint, InEndpoint, OutEndpoint } from 'usb';
import { Transport } from '../transport/Transport';
import { TransportEvent } from '../transport/ITransport';

const USB_TRANSPORT_RECEIVE_TIMEOUT = 0;
const USB_TRANSPORT_SEND_TIMEOUT = 10000;
const USB_TRANSPORT_CHUNK_SIZE = 16 * 1024;

export class UsbTransport extends Transport {
    private inEndpoint: InEndpoint;
    private outEndpoint: OutEndpoint;

    public constructor(device: Device) {
        super(USB_TRANSPORT_CHUNK_SIZE);

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

    public async receiveImpl(buffer: DataBuffer): Promise<number> {
        return this.sendOrReceive(
            this.inEndpoint,
            buffer,
            USB_TRANSPORT_RECEIVE_TIMEOUT,
        );
    }

    public async sendImpl(buffer: DataBuffer): Promise<number> {
        return this.sendOrReceive(
            this.outEndpoint,
            buffer,
            USB_TRANSPORT_SEND_TIMEOUT,
        );
    }
}
