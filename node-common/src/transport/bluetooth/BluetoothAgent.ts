import type { Agent, Device } from 'bluez';

export class BluetoothAgent implements Agent {
    public AgentCapabilities:
        | 'DisplayOnly'
        | 'DisplayYesNo'
        | 'KeyboardOnly'
        | 'NoInputNoOutput'
        | 'KeyboardDisplay' = 'KeyboardDisplay';

    public RequestPinCode(device: Device): string | Promise<string> {
        throw new Error('Method not implemented.');
    }

    public DisplayPinCode(
        device: Device,
        pincode: string,
    ): void | Promise<void> {
        throw new Error('Method not implemented.');
    }

    public RequestPasskey(device: Device): number | Promise<number> {
        throw new Error('Method not implemented.');
    }

    public DisplayPasskey(
        device: Device,
        passkey: number,
        entered: number,
    ): void | Promise<void> {
        throw new Error('Method not implemented.');
    }

    public RequestConfirmation(
        device: Device,
        passkey: number,
    ): void | Promise<void> {
        throw new Error('Method not implemented.');
    }

    public RequestAuthorization(device: Device): void | Promise<void> {
        throw new Error('Method not implemented.');
    }

    public Cancel(): void | Promise<void> {
        throw new Error('Method not implemented.');
    }
}
