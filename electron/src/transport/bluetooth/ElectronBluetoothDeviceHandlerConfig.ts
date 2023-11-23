import { INetworkInfo, ISocketInfoRequest } from '@web-auto/android-auto-proto';

export interface ElectronBluetoothDeviceHandlerConfig {
    networkInfo: INetworkInfo;
    socketInfo: ISocketInfoRequest;
}
