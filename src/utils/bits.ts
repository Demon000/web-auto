export const bit = (i: number) => {
    const maxBit = 31;
    if (i > maxBit) {
        throw new Error(`Bit ${i} bigger than maximum bit ${maxBit}`);
    }

    return 1 << i;
};

export const mask = (h: number, l: number) => {
    if (h < l) {
        throw new Error(`High value ${h} cannot be smaller than ${l}`);
    }

    return bit(h + 1) - 1 - (bit(l) - 1);
};
