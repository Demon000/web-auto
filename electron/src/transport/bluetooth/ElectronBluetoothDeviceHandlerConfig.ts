import {
    SocketInfoRequest,
    NetworkInfo,
} from '@web-auto/android-auto-proto/bluetooth.js';
import type { PartialMessage } from '@bufbuild/protobuf';

export interface ElectronBluetoothDeviceHandlerConfig {
    networkInfo: PartialMessage<NetworkInfo>;
    socketInfo: PartialMessage<SocketInfoRequest>;
}
