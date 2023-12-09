import {
    Device,
    DeviceDisconnectReason,
    type DeviceEvents,
    DeviceState,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import { Device as BluezDevice } from 'bluez';
import { type ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig.js';
import { BluetoothDeviceProfileConnector } from './BluetoothDeviceProfileConnector.js';
import { BluetoothDeviceWifiConnector } from './BluetoothDeviceWifiConnector.js';
import { Server } from 'node:net';
import { BluetoothDeviceTcpConnector } from './BluetoothDeviceTcpConnector.js';
import { ElectronDuplexTransport } from '../ElectronDuplexTransport.js';
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
        name: string,
        events: DeviceEvents,
    ) {
        super('BT', name, events);

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
            await this.setState(DeviceState.SELF_CONNECTING);

            let canConnect = false;

            try {
                canConnect = await this.events.onSelfConnect(this);
            } catch (err) {
                this.logger.error('Failed to emit self connect event', err);
            }

            if (!canConnect) {
                return;
            }

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
            /*
             * The profile connector is waiting for disconnection event.
             */
            this.state === DeviceState.DISCONNECTING ||
            /*
             * The disconnection event will cancel the connection event.
             */
            this.state === DeviceState.CONNECTING
        ) {
            await this.profileConnector.onDisconnect();
        } else if (
            /*
             * The connection event previously fired on its own triggering a self
             * connection, but the self connection has not been accepted.
             */
            this.state === DeviceState.SELF_CONNECTING
        ) {
            await this.profileConnector.onDisconnect();
            await this.setState(DeviceState.AVAILABLE);
        }
    }

    private async disconnectBluetooth(): Promise<void> {
        this.logger.info('Disconnecting from Bluetooth');
        try {
            await this.device.Disconnect();
        } catch (err) {
            this.logger.info('Failed to disconnect from Bluetooth', err);
            return;
        }
        this.logger.info('Disconnected from Bluetooth');
    }

    private async disconnectBluetoothProfile(): Promise<void> {
        this.logger.info('Disconnecting from Bluetooth profile');
        try {
            await this.profileConnector.disconnect();
        } catch (err) {
            this.logger.info(
                'Failed to disconnect from Bluetooth profile',
                err,
            );
            return;
        }
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

    public async connectImpl(events: TransportEvents): Promise<Transport> {
        const paired = await this.device.Paired();
        if (!paired) {
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
            this.logger.error('Failed to connect to Bluetooth profile', err);
            await this.disconnectBluetooth();
            throw err;
        }

        try {
            this.logger.info('Connecting to WiFi');
            await this.wifiConnector.connect(bluetoothSocket);
            this.logger.info('Connected to WiFi');
        } catch (err) {
            this.logger.error('Failed to connect to WiFi', err);
            await this.disconnectBluetoothProfile();
            await this.disconnectBluetooth();
            throw err;
        }

        try {
            this.logger.info('Waiting for TCP connection');
            this.tcpSocket = await this.tcpConnector.connect();
            this.logger.info('TCP connection received');
        } catch (err) {
            this.logger.error('Failed to receive TCP connection', err);
            await this.disconnectBluetoothProfile();
            await this.disconnectBluetooth();
            throw err;
        }

        return new ElectronDuplexTransport(this.tcpSocket, events);
    }
}
