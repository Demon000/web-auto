import { ITransport } from './ITransport';
import { Device, Endpoint, InEndpoint, OutEndpoint } from 'usb';

const USB_TRANSPORT_RECEIVE_TIMEOUT = 0;
const USB_TRANSPORT_SEND_TIMEOUT = 10000;

export class UsbTransport implements ITransport {
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
        this.outEndpoint = outEndpoint;
    }

    private async sendOrReceive(
        endpoint: Endpoint,
        buffer: Buffer,
        size: number,
        timeout: number,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const transfer = endpoint.makeTransfer(
                timeout,
                (error, buffer, length) => {
                    if (length != size) {
                        console.log(
                            `Expected to read ${size} but read ${length}`,
                        );
                    }

                    if (error) {
                        return reject(error);
                    }

                    resolve(buffer);
                },
            );

            transfer.submit(buffer);
        });
    }

    public async receive(size: number): Promise<Buffer> {
        const timeout = USB_TRANSPORT_RECEIVE_TIMEOUT;
        const buffer = Buffer.allocUnsafe(size);

        return this.sendOrReceive(this.inEndpoint, buffer, size, timeout);
    }

    public startReceivePoll(): void {
        this.inEndpoint.startPoll();
    }

    public onReceiveData(callback: (data: Buffer) => void): void {
        this.inEndpoint.addListener('data', callback);
    }

    public stopReceivePoll(): void {
        this.inEndpoint.stopPoll();
    }

    public async send(buffer: Buffer): Promise<Buffer> {
        const timeout = USB_TRANSPORT_SEND_TIMEOUT;
        const size = buffer.length;

        return this.sendOrReceive(this.outEndpoint, buffer, size, timeout);
    }
}
