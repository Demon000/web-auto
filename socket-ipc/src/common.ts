import type { IpcEvent, IpcSerializer } from '@web-auto/common-ipc';
import { pack, unpack } from 'msgpackr';

export class MessagePackIpcSerializer implements IpcSerializer {
    public serialize(ipcEvent: IpcEvent): Uint8Array {
        return pack(ipcEvent);
    }

    public deserialize(data: Uint8Array): IpcEvent {
        return unpack(data) as IpcEvent;
    }
}
