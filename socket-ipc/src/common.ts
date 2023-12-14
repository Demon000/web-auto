import type { DeserializeOptions } from 'bson';

export const BsonDeserializeOptions: DeserializeOptions = {
    useBigInt64: true,
    promoteBuffers: true,
    promoteValues: true,
};
