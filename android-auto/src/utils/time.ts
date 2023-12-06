export const microsecondsTime = () => {
    return BigInt(new Date().getTime()) * 1000n;
};

export const milliToMicro = (milli: number) => {
    return BigInt(milli) * 1000n;
};
