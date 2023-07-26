import { Device } from 'usb';

export const getStringDescriptor = (
    device: Device,
    id: number,
): Promise<string> => {
    return new Promise((resolve, reject) =>
        device.getStringDescriptor(id, (error, text) => {
            if (error || text === undefined) {
                return reject(new Error('Failed to get string descriptor'));
            }

            resolve(text);
        }),
    );
};
