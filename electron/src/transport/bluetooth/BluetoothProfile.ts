import { Device, type Profile, type ProfileOptions } from 'bluez';
import type { BluetoothProfileHandler } from './BluetoothProfileHandler.js';
import assert from 'assert';
import { getLogger } from '@web-auto/logging';

export class BluetoothProfile implements Profile {
    private logger = getLogger(this.constructor.name);

    public UUID: string;
    public ProfileOptions: Partial<ProfileOptions>;
    private addressHandlerMap = new Map<string, BluetoothProfileHandler>();

    public constructor(uuid: string, options: Partial<ProfileOptions>) {
        this.UUID = uuid;
        this.ProfileOptions = options;
    }

    public addHandler(address: string, handler: BluetoothProfileHandler): void {
        assert(!this.addressHandlerMap.has(address));
        this.addressHandlerMap.set(address, handler);
    }

    public removeHandler(
        address: string,
        handler: BluetoothProfileHandler,
    ): void {
        assert(this.addressHandlerMap.get(address) === handler);
        this.addressHandlerMap.delete(address);
    }

    private getHandler(address: string): BluetoothProfileHandler | undefined {
        return this.addressHandlerMap.get(address);
    }

    public async NewConnection(
        device: Device,
        fd: number,
        _options: Record<string, any>,
    ): Promise<void> {
        let address: string | undefined;

        try {
            address = await device.Address();
        } catch (err) {
            this.logger.error('Failed to get device address', err);
            return;
        }

        const handler = this.getHandler(address);
        if (handler === undefined) {
            this.logger.error(
                `Received new connection from unhandled address ${address}`,
            );
            return;
        }

        try {
            await handler.connect(fd);
        } catch (err) {
            this.logger.error(`Failed to connect address ${address}`, err);
        }
    }
}
