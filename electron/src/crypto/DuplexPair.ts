import assert from 'node:assert';
import { Duplex } from 'node:stream';
import type { DuplexOptions } from 'stream';

const kCallback = Symbol('Callback');
const kOtherSide = Symbol('Other');

type CallbackType = (error?: Error | null) => void;

class DuplexSocket extends Duplex {
    public [kCallback]?: CallbackType;
    private [kOtherSide]?: DuplexSocket;

    public constructor(options: DuplexOptions | undefined) {
        super(options);
    }

    public _read() {
        const callback = this[kCallback];
        if (callback) {
            this[kCallback] = undefined;
            callback();
        }
    }

    public _write(
        chunk: any,
        _encoding: BufferEncoding,
        callback: CallbackType,
    ) {
        if (chunk.length === 0) {
            process.nextTick(callback);
        } else {
            assert(this[kOtherSide] !== undefined);
            this[kOtherSide].push(chunk);
            this[kOtherSide][kCallback] = callback;
        }
    }

    public _final(callback: CallbackType) {
        assert(this[kOtherSide] !== undefined);
        this[kOtherSide].on('end', callback);
        this[kOtherSide].push(null);
    }
}

class DuplexPair {
    public socket1: DuplexSocket;
    public socket2: DuplexSocket;

    public constructor(options: DuplexOptions | undefined) {
        this.socket1 = new DuplexSocket(options);
        this.socket2 = new DuplexSocket(options);

        this.socket1[kOtherSide] = this.socket2;
        this.socket2[kOtherSide] = this.socket1;
    }
}

module.exports = DuplexPair;
