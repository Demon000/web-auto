export const toHex = (value: number, padding: number) =>
    value.toString(16).padStart(padding, '0').toUpperCase();
