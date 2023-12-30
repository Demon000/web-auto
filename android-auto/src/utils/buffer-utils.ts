export const bufferWrapUint8Array = (buffer: Uint8Array): Buffer => {
    let actualBuffer;

    if (buffer instanceof Buffer) {
        actualBuffer = buffer;
    } else {
        actualBuffer = Buffer.from(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
        );
    }

    return actualBuffer;
};
