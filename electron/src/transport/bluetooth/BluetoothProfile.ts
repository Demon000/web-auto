import BluetoothSocket from 'bluetooth-socket';
import { Device, Profile, ProfileOptions } from 'bluez';
import EventEmitter from 'eventemitter3';

export enum BluetoothProfileEvent {
    CONNECTED = 'connected',
    ERROR = 'error',
    DISCONNECTED = 'disconnected',
}

export interface BluetoothProfileEvents {
    [BluetoothProfileEvent.CONNECTED]: (
        address: string,
        socket: BluetoothSocket,
    ) => void;
    [BluetoothProfileEvent.DISCONNECTED]: (address: string) => void;
}

export class BluetoothProfile implements Profile {
    public emitter = new EventEmitter<BluetoothProfileEvents>();

    public UUID: string;
    public ProfileOptions: Partial<ProfileOptions>;

    public constructor(uuid: string, options: Partial<ProfileOptions>) {
        this.UUID = uuid;
        this.ProfileOptions = options;
    }

    public async NewConnection(
        device: Device,
        fd: number,
        _options: Record<string, any>,
    ): Promise<void> {
        const address = await device.Address();

        console.log(`NewConnection: ${address}`, device, fd);

        /*
         * Open the socket automatically just to handle close events.
         */
        let socket;
        try {
            socket = new BluetoothSocket(fd);
        } catch (err) {
            console.log(err);
            return;
        }

        /*
         * RequestDisconnection is only called if the stack initiates the
         * disconnection, not if the remote end does it.
         * Listen to the close event.
         */
        socket.once('close', () => {
            this.emitter.emit(BluetoothProfileEvent.DISCONNECTED, address);
        });

        this.emitter.emit(BluetoothProfileEvent.CONNECTED, address, socket);
    }
}
