import { defineStore } from 'pinia';
import { Ref, computed, ref } from 'vue';
import { androidAutoServerService } from '../ipc.ts';
import { IDevice } from '@web-auto/android-auto-ipc';

export const useDeviceStore = defineStore('device', () => {
    const devices: Ref<IDevice[]> = ref([]);

    async function initialize() {
        devices.value = await androidAutoServerService.getDevices();

        androidAutoServerService.on('devices', (newDevices) => {
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
