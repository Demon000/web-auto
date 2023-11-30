import BluetoothSocket from 'bluetooth-socket';
import { Device, Profile, ProfileOptions } from 'bluez';

export interface BluetoothProfileEvents {
    onConnected: (address: string, socket: BluetoothSocket) => Promise<void>;
    onDisconnected: (address: string) => Promise<void>;
}

export class BluetoothProfile implements Profile {
    public UUID: string;
    public ProfileOptions: Partial<ProfileOptions>;

    public constructor(
        uuid: string,
        options: Partial<ProfileOptions>,
        private events: BluetoothProfileEvents,
    ) {
        this.UUID = uuid;
        this.ProfileOptions = options;
    }

    public async NewConnection(
        device: Device,
        fd: number,
        _options: Record<string, any>,
    ): Promise<void> {
        const address = await device.Address();

        /*
         * Open the socket automatically just to handle close events.
         */
        const socket = new BluetoothSocket(fd);

        /*
         * RequestDisconnection is only called if the stack initiates the
         * disconnection, not if the remote end does it.
         * Listen to the close event.
         */
        socket.once('close', async () => {
            await this.events.onDisconnected(address);
        });

        await this.events.onConnected(address, socket);
    }
}
