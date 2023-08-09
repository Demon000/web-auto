import Long from 'long';

export const microsecondsTime = () => {
    return Long.fromNumber(new Date().getTime(), true).multiply(1000);
};
