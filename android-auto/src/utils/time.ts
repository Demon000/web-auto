import Long from 'long';
import assert from 'node:assert';

export const milliTime = () => {
    return new Date().getTime();
};

export const microsecondsTime = () => {
    return Long.fromNumber(new Date().getTime(), true).multiply(1000);
};

export const microToMilli = (micro: Long | number) => {
    assert(Long.isLong(micro));
    return micro.divide(1000).toNumber();
};

export const milliToMicro = (milli: number) => {
    return Long.fromNumber(milli, true).multiply(1000);
};
