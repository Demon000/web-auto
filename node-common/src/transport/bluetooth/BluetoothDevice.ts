import {
    Device,
    DeviceDisconnectReason,
    type DeviceEvents,
    DeviceState,
    Transport,
    type TransportEvents,
} from '@web-auto/android-auto';
import { Device as BluezDevice } from 'bluez';
import { type ElectronBluetoothDeviceHandlerConfig } from './BluetoothDeviceHandlerConfig.js';
import { BluetoothDeviceWifiConnector } from './BluetoothDeviceWifiConnector.js';
import { Server } from 'node:net';
import { BluetoothDeviceTcpConnector } from './BluetoothDeviceTcpConnector.js';
import { DuplexTransport } from '../DuplexTransport.js';
import { Duplex } from 'node:stream';
import { BluetoothProfileHandler } from './BluetoothProfileHandler.js';

enum BluetoothDeviceDisconnectReason {
    BLUETOOTH_PROFILE = 'bluetooth-profile-disconnected',
}

class BluetoothProfileDisconnectedError extends Error {}

export class BluetoothDevice extends Device {
    public profileHandler: BluetoothProfileHandler;
    private wifiConnector: BluetoothDeviceWifiConnector;
    private tcpConnector: BluetoothDeviceTcpConnector;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private device: BluezDevice,
        address: string,
        tcpServer: Server,
        name: string,
        events: DeviceEvents,
    ) {
        super('BT', name, events);

        this.profileHandler = new BluetoothProfileHandler(
            {
                onUnhandledConnection:
                    this.onBluetoothProfileSelfConnected.bind(this),
                onUnhandledDisconnected:
                    this.onBluetoothProfileSelfDisconnected.bind(this),
                onError: this.onBluetoothProfileError.bind(this),
            },
            name,
        );

        this.wifiConnector = new BluetoothDeviceWifiConnector(
            this.config,
            name,
        );

        this.tcpConnector = new BluetoothDeviceTcpConnector(tcpServer, name);
    }

    private onBluetoothProfileError(err: Error): void {
        this.logger.error('Received bluetooth profile error', err);
    }

    public async onBluetoothProfileSelfConnected(): Promise<void> {
        if (this.state !== DeviceState.AVAILABLE) {
            this.logger.error(
                `Unexpected bluetooth profile self-connection in state: ${this.state}`,
            );
            return;
        }

        this.logger.info('Received bluetooth profile self-connection');

        await this.setState(DeviceState.SELF_CONNECTING);

        void this.events.onSelfConnection(this);
    }

    public async rejectSelfConnection(): Promise<void> {
        if (this.state !== DeviceState.SELF_CONNECTING) {
            this.logger.error(
                `Unexpected self-connection reject in state: ${this.state}`,
            );
            return;
        }

        this.logger.info('Bluetooth profile self-connection denied');
        await this.disconnectBluetoothProfile();
        await this.disconnectBluetooth();
    }

    public async onBluetoothProfileSelfDisconnected(): Promise<void> {
        if (this.state !== DeviceState.AVAILABLE) {
            this.logger.error(
                `Unexpected bluetooth profile disconnection in state: ${this.state}`,
            );
        }

        await this.selfDisconnect(
            BluetoothDeviceDisconnectReason.BLUETOOTH_PROFILE,
        );
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
            await this.profileHandler.disconnect();
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

    public async connectWifi(bluetoothSocket: Duplex): Promise<void> {
        this.logger.info('Connecting to WiFi');
        try {
            await this.wifiConnector.connectWithTimeout(
                bluetoothSocket,
                this.config.wifiConnectionTimeoutMs,
            );
        } catch (err) {
            this.logger.error('Failed to connect to WiFi', err);
            throw err;
        }
        this.logger.info('Connected to WiFi');
    }

    public async connectTcp(): Promise<Duplex> {
        let socket;

        this.logger.info('Waiting for TCP connection');
        try {
            socket = await this.tcpConnector.connectWithTimeout(
                this.config.tcpConnectionTimeoutMs,
            );
        } catch (err) {
            this.logger.error('Failed to receive TCP connection', err);
            throw err;
        }
        this.logger.info('TCP connection received');

        return socket;
    }

    public async connectWifiAndTcp(bluetoothSocket: Duplex): Promise<Duplex> {
        await this.connectWifi(bluetoothSocket);
        return this.connectTcp();
    }

    public waitForTcpConnection(bluetoothSocket: Duplex): Promise<Duplex> {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const signal = controller.signal;

            this.profileHandler
                .waitForDisconnection(signal)
                .then(() => {
                    reject(
                        new BluetoothProfileDisconnectedError(
                            'Bluetooth profile disconnected while waiting',
                        ),
                    );
                })
                .catch(() => {});

            this.connectWifiAndTcp(bluetoothSocket)
                .then((socket) => {
                    controller.abort();
                    resolve(socket);
                })
                .catch((err) => {
                    controller.abort();
                    reject(err);
                });
        });
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
            bluetoothSocket =
                await this.profileHandler.waitForConnectionWithTimeout(
                    this.config.profileConnectionTimeoutMs,
                );
            this.logger.info('Connected to Bluetooth profile');
        } catch (err) {
            this.logger.error('Failed to connect to Bluetooth profile', err);
            await this.disconnectBluetooth();
            throw err;
        }

        let tcpSocket;
        try {
            tcpSocket = await this.waitForTcpConnection(bluetoothSocket);
        } catch (err) {
            this.logger.error('Failed to wait for TCP connection', err);
            if (!(err instanceof BluetoothProfileDisconnectedError)) {
                await this.disconnectBluetoothProfile();
            }
            await this.disconnectBluetooth();
            throw err;
        }

        return new DuplexTransport(tcpSocket, events);
    }
}