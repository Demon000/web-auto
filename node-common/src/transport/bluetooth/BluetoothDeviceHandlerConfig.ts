import type {
    INetworkInfo,
    ISocketInfoRequest,
} from '@web-auto/android-auto-proto/bluetooth_interfaces.js';

export interface ElectronBluetoothDeviceHandlerConfig {
    profileConnectionTimeoutMs: number;
    wifiConnectionTimeoutMs: number;
    tcpConnectionTimeoutMs: number;
    networkInfo: INetworkInfo;
    socketInfo: ISocketInfoRequest;
}
