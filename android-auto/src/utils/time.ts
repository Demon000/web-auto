import Long from 'long';

export const milliTime = () => {
    return new Date().getTime();
};

export const microsecondsTime = () => {
    return Long.fromNumber(new Date().getTime(), true).multiply(1000);
};

export const microToMilli = (micro: Long) => {
    return micro.divide(1000).toNumber();
};

export const milliToMicro = (milli: number) => {
    return Long.fromNumber(milli, true).multiply(1000);
};
