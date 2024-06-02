import {
    BluetoothAuthenticationData,
    BluetoothAuthenticationResult,
    BluetoothMessageId,
    BluetoothPairingRequest,
    BluetoothPairingResponse,
    BluetoothService as ProtoBluetoothService,
    type Service as ProtoService,
} from '@web-auto/android-auto-proto';
import { Service, type ServiceEvents } from './Service.js';

export abstract class BluetoothService extends Service {
    public constructor(events: ServiceEvents) {
        super(events);
    }

    protected abstract pair(
        data: BluetoothPairingRequest,
    ): Promise<BluetoothPairingResponse>;

    protected sendPairingResponse(data: BluetoothPairingResponse): void {
        this.sendEncryptedSpecificMessage(
            BluetoothMessageId.BLUETOOTH_MESSAGE_PAIRING_RESPONSE,
            data,
        );
    }

    protected sendAuthenticationData(data: BluetoothAuthenticationData): void {
        this.sendEncryptedSpecificMessage(
            BluetoothMessageId.BLUETOOTH_MESSAGE_AUTHENTICATION_DATA,
            data,
        );
    }

    public override async onSpecificMessage(
        messageId: number,
        payload: Uint8Array,
    ): Promise<boolean> {
        let data;

        switch (messageId as BluetoothMessageId) {
            case BluetoothMessageId.BLUETOOTH_MESSAGE_PAIRING_REQUEST:
                data = BluetoothPairingRequest.fromBinary(payload);
                this.printReceive(data);
                await this.onBluetoothPairingRequest(data);
                break;
            case BluetoothMessageId.BLUETOOTH_MESSAGE_AUTHENTICATION_RESULT:
                data = BluetoothAuthenticationResult.fromBinary(payload);
                this.printReceive(data);
                break;
            default:
                return super.onSpecificMessage(messageId, payload);
        }

        return true;
    }

    protected async onBluetoothPairingRequest(
        data: BluetoothPairingRequest,
    ): Promise<void> {
        const response = await this.pair(data);
        this.sendPairingResponse(response);
    }

    protected fillChannelDescriptor(channelDescriptor: ProtoService): void {
        channelDescriptor.bluetoothService = new ProtoBluetoothService({});
    }
}
