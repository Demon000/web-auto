import { usb, getDeviceList } from 'usb';

export function enumerateDevices(): usb.Device[] {
    return getDeviceList();
}
