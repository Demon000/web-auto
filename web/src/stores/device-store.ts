import { defineStore } from 'pinia';
import { Ref, computed, ref } from 'vue';
import {
    AndroidAutoServerClient,
    AndroidAutoServerService,
    IDevice,
} from '@web-auto/node-common/ipc.js';
import { IpcClientHandler } from '@web-auto/common-ipc/renderer.js';

export const useDeviceStore = (
    service: IpcClientHandler<
        AndroidAutoServerClient,
        AndroidAutoServerService
    >,
) =>
    defineStore(service.handle, () => {
        const devices: Ref<IDevice[]> = ref([]);
        let initialized = false;

        async function initialize() {
            if (initialized) {
                return;
            }

            devices.value = await service.getDevices();

            service.on('devices', (newDevices) => {
                devices.value = newDevices;
            });

            initialized = true;
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
    })();
