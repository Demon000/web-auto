import { Device } from '@web-auto/android-auto';
import { Device as BluezDevice } from 'bluez';
import { BluetoothProfile } from './BluetoothProfile';
import { ElectronBluetoothDeviceHandlerConfig } from './ElectronBluetoothDeviceHandlerConfig';
import { BluetoothDeviceProfileConnector } from './BluetoothDeviceProfileConnector';
import { BluetoothDeviceWifiConnector } from './BluetoothDeviceWifiConnector';
import { Server } from 'node:net';
import { BluetoothDeviceTcpConnector } from './BluetoothDeviceTcpConnector';
import { ElectronDuplexTransport } from '../ElectronDuplexTransport';

export class BluetoothDevice extends Device {
    private profileConnector: BluetoothDeviceProfileConnector;
    private wifiConnector: BluetoothDeviceWifiConnector;
    private tcpConnector: BluetoothDeviceTcpConnector;

    public constructor(
        private config: ElectronBluetoothDeviceHandlerConfig,
        private device: BluezDevice,
        profile: BluetoothProfile,
        tcpServer: Server,
        private needsPair: boolean,
        address: string,
        name: string,
    ) {
        super('BT', name);

        this.profileConnector = new BluetoothDeviceProfileConnector(
            device,
            profile,
            address,
            name,
        );

        this.wifiConnector = new BluetoothDeviceWifiConnector(
            this.config,
            name,
        );

        this.tcpConnector = new BluetoothDeviceTcpConnector(tcpServer, name);
    }

    private async disconnectDevice(): Promise<void> {
        await this.device.Disconnect();
    }

    public async connect(): Promise<void> {
        if (this.needsPair) {
            await this.device.Pair();
        }

        let bluetoothSocket;
        try {
            bluetoothSocket = await this.profileConnector.connect();
        } catch (err) {
            await this.disconnectDevice();
            throw err;
        }

        try {
            await this.wifiConnector.connect(bluetoothSocket);
        } catch (err) {
            await this.disconnectDevice();
            throw err;
        }

        let tcpSocket;
        try {
            tcpSocket = await this.tcpConnector.connect();
        } catch (err) {
            await this.disconnectDevice();
            throw err;
        }

        const transport = new ElectronDuplexTransport(tcpSocket);
        this.handleConnect(transport);
    }

    public async disconnect(): Promise<void> {
        await this.disconnectDevice();
        return super.disconnect();
    }
}
