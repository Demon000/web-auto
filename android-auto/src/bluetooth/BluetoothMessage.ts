import { DataBuffer } from '..';
import { BluetoothMessageType } from './BluetoothMessageType';

export class BluetoothMessage {
    public constructor(
        public type: BluetoothMessageType,
        public payload: DataBuffer,
    ) {}
}
