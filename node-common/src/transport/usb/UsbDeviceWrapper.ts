import assert from 'node:assert';
import {
    InEndpoint,
    LibUSBException,
    OutEndpoint,
    usb,
    Device as UsbDeviceImpl,
} from 'usb';
import { bufferWrapUint8Array } from '@web-auto/android-auto';
import { getLogger } from '@web-auto/logging';
import { Mutex } from 'async-mutex';

const toHex = (n: number) => n.toString(16).padStart(4, '0');

const getStringDescriptor = (
    device: UsbDeviceImpl,
    index: number,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        device.getStringDescriptor(index, (error, value) => {
            if (error !== undefined) {
                return reject(error);
            }

            if (value === undefined) {
                value = '';
            }

            resolve(value);
        });
    });
};

export type UsbDeviceWrapperEndpointTransferOutFunction = (
    buffer: Uint8Array,
) => Promise<void>;

export type UsbDeviceWrapperEndpointPollFunction = (buffer: Buffer) => void;
export type UsbDeviceWrapperEndpointErrorFunction = (err: Error) => void;

export type UsbDeviceWrapperEndpointStartStopPollFunction = (
    callback: UsbDeviceWrapperEndpointPollFunction,
    errorCallback: UsbDeviceWrapperEndpointErrorFunction,
) => void;

export class UsbDeviceWrapper {
    public vendorId: number;
    public productId: number;
    public opened = false;

    public constructor(
        private device: UsbDeviceImpl,
        public name: string,
    ) {
        this.vendorId = device.deviceDescriptor.idVendor;
        this.productId = device.deviceDescriptor.idProduct;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async open(): Promise<void> {
        assert(!this.opened);
        this.device.open();
        this.opened = true;
    }

    public reset(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.opened = false;

            this.device.reset((error) => {
                if (error !== undefined) {
                    return reject(error);
                }

                resolve();
            });
        });
    }

    public close(): void {
        assert(this.opened);
        try {
            this.device.close();
        } catch (err) {
            // do nothing
        }
        this.opened = false;
    }

    public getInterfaceTransferFunctions(
        index: number,
    ): [
        UsbDeviceWrapperEndpointTransferOutFunction,
        UsbDeviceWrapperEndpointStartStopPollFunction,
        UsbDeviceWrapperEndpointStartStopPollFunction,
    ] {
        const intf = this.device.interface(index);

        let inEndpoint: InEndpoint | undefined;
        let outEndpoint: OutEndpoint | undefined;

        const endpoints = intf.endpoints;
        for (const endpoint of endpoints) {
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

        const transferOut = (buffer: Uint8Array): Promise<void> => {
            return new Promise((resolve, reject) => {
                assert(outEndpoint !== undefined);
                const transfer = outEndpoint.makeTransfer(
                    1000,
                    (error, _data, _length) => {
                        if (error) {
                            return reject(error);
                        }

                        resolve();
                    },
                );

                transfer.submit(bufferWrapUint8Array(buffer));
            });
        };

        const startPoll = (
            callback: UsbDeviceWrapperEndpointPollFunction,
            errorCallback: UsbDeviceWrapperEndpointErrorFunction,
        ): void => {
            assert(inEndpoint !== undefined);
            if (inEndpoint.pollActive) {
                return;
            }

            inEndpoint.startPoll(3, 16384);
            inEndpoint.on('data', callback);
            inEndpoint.on('error', errorCallback);
        };

        const stopPoll = (
            callback: UsbDeviceWrapperEndpointPollFunction,
            errorCallback: UsbDeviceWrapperEndpointErrorFunction,
        ): void => {
            assert(inEndpoint !== undefined);
            inEndpoint.off('data', callback);
            inEndpoint.off('error', errorCallback);
            inEndpoint.stopPoll();
        };

        return [transferOut, startPoll, stopPoll];
    }

    public vendorControlTransferIn(
        request: number,
        value: number,
        index: number,
        length: number,
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this.device.controlTransfer(
                usb.LIBUSB_ENDPOINT_IN | usb.LIBUSB_REQUEST_TYPE_VENDOR,
                request,
                value,
                index,
                length,
                (
                    error: LibUSBException | undefined,
                    buffer: number | Buffer | undefined,
                ) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve(buffer as Buffer);
                },
            );
        });
    }

    public vendorControlTransferOut(
        request: number,
        value: number,
        index: number,
        buffer: Buffer,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.device.controlTransfer(
                usb.LIBUSB_ENDPOINT_OUT | usb.LIBUSB_REQUEST_TYPE_VENDOR,
                request,
                value,
                index,
                buffer,
                (
                    error: LibUSBException | undefined,
                    _buffer: number | Buffer | undefined,
                ) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve();
                },
            );
        });
    }

    public claimInterface(index: number): void {
        this.device.interface(index).claim();
    }

    public async releaseInterface(index: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.device.interface(index).release(false, (error) => {
                if (error !== undefined) {
                    return reject(error);
                }

                resolve();
            });
        });
    }

    public static async create(
        device: UsbDeviceImpl,
    ): Promise<UsbDeviceWrapper> {
        device.open();

        const descriptor = device.deviceDescriptor;

        const manufacturerName = await getStringDescriptor(
            device,
            descriptor.iManufacturer,
        );

        const productName = await getStringDescriptor(
            device,
            descriptor.iProduct,
        );

        let name;
        if (productName !== undefined && productName.length !== 0) {
            name = productName;
        } else if (
            manufacturerName !== undefined &&
            manufacturerName.length !== 0
        ) {
            name = manufacturerName;
        } else {
            const vendor = toHex(descriptor.idVendor);
            const product = toHex(descriptor.idProduct);
            name = `${vendor}:${product}`;
        }

        device.close();

        return new UsbDeviceWrapper(device, name);
    }
}

export type UsbWrapperEventCallback = (device: UsbDeviceWrapper) => void;

export class UsbCallbackWrapper {
    private logger = getLogger(this.constructor.name);

    private onAttachInternalBound: (device: UsbDeviceImpl) => void;
    private onDetachInternalBound: (device: UsbDeviceImpl) => void;
    private deviceMap = new Map<UsbDeviceImpl, UsbDeviceWrapper>();
    private deviceMapLock = new Mutex();
    private registered = false;

    public constructor(
        private onConnect: UsbWrapperEventCallback,
        private onDisconnect: UsbWrapperEventCallback,
    ) {
        this.onAttachInternalBound = (device) => {
            this.onAttachInternal(device, true)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to handle device attach', err);
                });
        };
        this.onDetachInternalBound = (device) => {
            this.onDetachInternal(device)
                .then(() => {})
                .catch((err) => {
                    this.logger.error('Failed to handle device detach', err);
                });
        };
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getDevices(): Promise<UsbDeviceWrapper[]> {
        return Array.from(this.deviceMap.values());
    }

    private async onAttachInternal(
        device: UsbDeviceImpl,
        callEvent: boolean,
    ): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        let deviceWrapper;
        try {
            deviceWrapper = await UsbDeviceWrapper.create(device);
        } catch (err) {
            this.logger.error('Failed to create device wrapper', {
                device,
                err,
            });
            release();
            return;
        }
        this.deviceMap.set(device, deviceWrapper);
        if (callEvent) {
            this.onConnect(deviceWrapper);
        }
        release();
    }

    private async onDetachInternal(device: UsbDeviceImpl): Promise<void> {
        const release = await this.deviceMapLock.acquire();
        const deviceWrapper = this.deviceMap.get(device);
        if (deviceWrapper === undefined) {
            this.logger.error('Failed to find device wrapper', device);
            release();
            return;
        }
        this.deviceMap.delete(device);
        this.onDisconnect(deviceWrapper);
        release();
    }

    public async register(): Promise<void> {
        assert(!this.registered);
        const devices = usb.getDeviceList();
        for (const device of devices) {
            await this.onAttachInternal(device, false);
        }
        usb.on('attach', this.onAttachInternalBound);
        usb.on('detach', this.onDetachInternalBound);
        this.registered = true;
    }

    public unregister(): void {
        assert(this.registered);
        usb.off('attach', this.onAttachInternalBound);
        usb.off('detach', this.onDetachInternalBound);
        this.registered = false;
    }
}
