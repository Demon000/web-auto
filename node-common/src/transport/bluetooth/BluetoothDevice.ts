import {
    Device,
    type DeviceEvents,
    DeviceState,
    type DeviceDisconnectReason,
    DeviceConnectReason,
    DeviceCreateIgnoredError,
} from '@web-auto/android-auto';
import { Device as BluezDevice } from 'bluez';
import { BluetoothDeviceWifiConnector } from './BluetoothDeviceWifiConnector.js';
import { Server } from 'node:net';
import { BluetoothDeviceTcpConnector } from './BluetoothDeviceTcpConnector.js';
import { DuplexTransport } from '../DuplexTransport.js';
import { Duplex } from 'node:stream';
import { BluetoothProfileHandler } from './BluetoothProfileHandler.js';
import type { BluetoothDeviceHandlerConfig } from './BluetoothDeviceHandler.js';
import { HSP_AG_UUID } from './AndroidAutoProfile.js';

enum BluetoothDeviceDisconnectReason {
    BLUETOOTH_PROFILE = 'bluetooth-profile-disconnected',
}

class BluetoothProfileDisconnectedError extends Error {}

export class BluetoothDevice extends Device {
    public profileHandler: BluetoothProfileHandler;
    private wifiConnector: BluetoothDeviceWifiConnector;
    private tcpConnector: BluetoothDeviceTcpConnector;
    private transport: DuplexTransport | undefined;

    public constructor(
        private config: BluetoothDeviceHandlerConfig,
        private device: BluezDevice,
        tcpServer: Server,
        name: string,
        address: string,
        events: DeviceEvents,
    ) {
        super('BT', name, address, events);

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

    public static async create(
        config: BluetoothDeviceHandlerConfig,
        device: BluezDevice,
        address: string,
        tcpServer: Server,
        events: DeviceEvents,
    ): Promise<BluetoothDevice | undefined> {
        let name;
        try {
            name = await device.Name();
        } catch (err) {
            throw new DeviceCreateIgnoredError('Failed to query name');
        }

        let uuids;
        try {
            uuids = await device.UUIDs();
        } catch (err) {
            throw new DeviceCreateIgnoredError('Failed to query UUIDs');
        }

        if (!uuids.includes(HSP_AG_UUID)) {
            throw new DeviceCreateIgnoredError('Does not have HSP AG UUID');
        }

        return new BluetoothDevice(
            config,
            device,
            tcpServer,
            name,
            address,
            events,
        );
    }

    private onBluetoothProfileError(err: Error): void {
        this.logger.error('Received bluetooth profile error', err);
    }

    public onBluetoothProfileSelfConnected(): void {
        if (this.state !== DeviceState.AVAILABLE) {
            this.logger.error(
                `Unexpected bluetooth profile self-connection in state: ${this.state}`,
            );
            return;
        }

        this.logger.info('Received bluetooth profile self-connection');

        this.selfConnect();
    }

    public onBluetoothProfileSelfDisconnected(): void {
        this.logger.info(
            `Received bluetooth profile disconnection in state: ${this.state}`,
        );

        this.selfDisconnect(BluetoothDeviceDisconnectReason.BLUETOOTH_PROFILE);
    }

    private async connectBluetooth(): Promise<void> {
        this.logger.info('Connecting to Bluetooth device');
        await this.device.Connect();
        this.logger.info('Connected to Bluetooth device');
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

    private async connectBluetoothProfile(): Promise<Duplex> {
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
            throw err;
        }

        return bluetoothSocket;
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

    public async connectImpl(reason: DeviceConnectReason): Promise<void> {
        if (reason !== DeviceConnectReason.SELF_CONNECT) {
            const paired = await this.device.Paired();
            if (!paired) {
                await this.device.Pair();
            }

            await this.connectBluetooth();
        }

        let bluetoothSocket;
        try {
            bluetoothSocket = await this.connectBluetoothProfile();
        } catch (err) {
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

        this.transport = new DuplexTransport(tcpSocket, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            onData: this.onDataBound,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            onDisconnected: this.onDisconnectedBound,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            onError: this.onErrorBound,
        });
    }

    protected override async disconnectImpl(
        reason: DeviceDisconnectReason,
    ): Promise<void> {
        if (this.transport !== undefined) {
            this.transport.disconnect();
            this.transport = undefined;
        }

        if (
            reason !==
            (BluetoothDeviceDisconnectReason.BLUETOOTH_PROFILE as string)
        ) {
            await this.disconnectBluetoothProfile();
        }

        await this.disconnectBluetooth();
    }

    public send(buffer: Uint8Array): void {
        if (this.transport === undefined) {
            this.logger.error('Device has no transport');
            return;
        }

        this.transport.send(buffer);
    }
}
