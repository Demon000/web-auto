import { BluetoothMessageType } from './BluetoothMessageType.js';

export class BluetoothMessage {
    public constructor(
        public type: BluetoothMessageType,
        public payload: Uint8Array,
    ) {}
}
