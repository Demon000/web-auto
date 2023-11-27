import {
    Device,
    DeviceDisconnectReason,
    DeviceState,
    Transport,
} from '@web-auto/android-auto';
import { Device as BluezDevice } from 'bluez';
import { ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig';
import { BluetoothDeviceProfileConnector } from './BluetoothDeviceProfileConnector';
import { BluetoothDeviceWifiConnector } from './BluetoothDeviceWifiConnector';
import { Server } from 'node:net';
import { BluetoothDeviceTcpConnector } from './BluetoothDeviceTcpConnector';
import { ElectronDuplexTransport } from '../ElectronDuplexTransport';
import { Duplex } from 'node:stream';

enum BluetoothDeviceDisconnectReason {
    BLUETOOTH_PROFILE = 'bluetooth-profile-disconnected',
}

export class BluetoothDevice extends Device {
    private profileConnector: BluetoothDeviceProfileConnector;
    private wifiConnector: BluetoothDeviceWifiConnector;
    private tcpConnector: BluetoothDeviceTcpConnector;
    private tcpSocket?: Duplex;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private device: BluezDevice,
        tcpServer: Server,
        private needsPair: boolean,
        name: string,
    ) {
        super('BT', name, true);

        this.profileConnector = new BluetoothDeviceProfileConnector();

        this.wifiConnector = new BluetoothDeviceWifiConnector(
            this.config,
            name,
        );

        this.tcpConnector = new BluetoothDeviceTcpConnector(tcpServer, name);
    }

    public async onBluetoothProfileConnected(socket: Duplex): Promise<void> {
        if (this.state === DeviceState.CONNECTING) {
            /*
             * Already trying to connect, pass the socket to the
             * connector to complete the connection.
             */
            this.profileConnector.onConnect(socket);
        } else if (this.state === DeviceState.AVAILABLE) {
            /*
             * Device connected itself. Set the bluetooth socket inside the
             * profile connector. Then start the connection process.
             * The connector will return the already existing bluetooth socket.
             */
            this.profileConnector.onConnect(socket);

            await this.connect();
        }
    }

    public async onBluetoothProfileDisconnected(): Promise<void> {
        if (this.state === DeviceState.CONNECTED) {
            /*
             * Bluetooth profile disconnection, disconnect transport.
             */
            await this.disconnect(
                BluetoothDeviceDisconnectReason.BLUETOOTH_PROFILE,
            );
        } else if (
            this.state === DeviceState.DISCONNECTING ||
            this.state === DeviceState.CONNECTING
        ) {
            /*
             * The profile connector is waiting for disconnection event.
             */
            await this.profileConnector.onDisconnect();
        }
    }

    private async disconnectBluetooth(): Promise<void> {
        this.logger.info('Disconnecting from Bluetooth');
        await this.device.Disconnect();
        this.logger.info('Disconnected from Bluetooth');
    }

    private async disconnectBluetoothProfile(): Promise<void> {
        this.logger.info('Disconnecting from Bluetooth profile');
        await this.profileConnector.disconnect();
        this.logger.info('Disconnected from Bluetooth profile');
    }

    protected async handleDisconnect(reason: string): Promise<void> {
        switch (reason) {
            case DeviceDisconnectReason.TRANSPORT:
            case DeviceDisconnectReason.USER:
                await this.disconnectBluetoothProfile();
                await this.disconnectBluetooth();
                break;
            case BluetoothDeviceDisconnectReason.BLUETOOTH_PROFILE:
                await this.disconnectBluetooth();
        }
    }

    public async connectImpl(): Promise<Transport> {
        if (this.needsPair) {
            await this.device.Pair();
        }

        this.logger.info('Connecting to Bluetooth device');
        await this.device.Connect();
        this.logger.info('Connected to Bluetooth device');

        let bluetoothSocket;
        try {
            this.logger.info('Connecting to Bluetooth profile');
            bluetoothSocket = await this.profileConnector.connect();
            this.logger.info('Connected to Bluetooth profile');
        } catch (err) {
            this.logger.error('Failed to connect to Bluetooth profile', {
                metadata: err,
            });
            await this.disconnectBluetooth();
            throw err;
        }

        try {
            this.logger.info('Connecting to WiFi');
            await this.wifiConnector.connect(bluetoothSocket);
            this.logger.info('Connected to WiFi');
        } catch (err) {
            this.logger.error('Failed to connect to WiFi', {
                metadata: err,
            });
            await this.disconnectBluetoothProfile();
            await this.disconnectBluetooth();
            throw err;
        }

        try {
            this.logger.info('Waiting for TCP connection');
            this.tcpSocket = await this.tcpConnector.connect();
            this.logger.info('TCP connection received');
        } catch (err) {
            this.logger.error('Failed to receive TCP connection', {
                metadata: err,
            });
            await this.disconnectBluetoothProfile();
            await this.disconnectBluetooth();
            throw err;
        }

        return new ElectronDuplexTransport(this.tcpSocket);
    }
}
