import { defineStore } from 'pinia';
import { Ref, computed, ref } from 'vue';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
    IDevice,
} from '@web-auto/android-auto-ipc';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useDeviceStore = defineStore('device', () => {
    const devices: Ref<IDevice[]> = ref([]);

    async function initialize(
        service: IpcClientHandler<
            AndroidAutoServerClient,
            AndroidAutoServerService
        >,
    ) {
        devices.value = await service.getDevices();

        service.on('devices', (newDevices) => {
            devices.value = newDevices;
        });
    }

    const connectedDevice = computed(() => {
        for (const device of devices.value) {
            if (device.state === 'connected') {
                return device;
            }
        }

        return undefined;
    });

    const notAvailableDevice = computed(() => {
        for (const device of devices.value) {
            if (device.state !== 'available') {
                return device;
            }
        }

        return undefined;
    });

    return { devices, connectedDevice, notAvailableDevice, initialize };
});
