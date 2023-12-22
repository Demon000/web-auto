import type { IpcEvent, IpcSerializer } from '@web-auto/common-ipc';
import { BSON } from 'bson';

export class BsonIpcSerializer implements IpcSerializer {
    public serialize(ipcEvent: IpcEvent): any {
        return BSON.serialize(ipcEvent);
    }

    public deserialize(data: any): IpcEvent {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return BSON.deserialize(data, {
            useBigInt64: true,
            promoteBuffers: true,
            promoteValues: true,
        }) as IpcEvent;
    }
}
