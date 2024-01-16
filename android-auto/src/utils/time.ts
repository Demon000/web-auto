export const microsecondsTime = () => {
    return BigInt(Date.now()) * 1000n;
};

export const milliToMicro = (milli: number) => {
    return BigInt(milli) * 1000n;
};
