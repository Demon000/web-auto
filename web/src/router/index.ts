import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import AndroidAutoDeviceSelector from '../components/AndroidAutoDeviceSelector.vue';
import AndroidAutoVideo from '../components/AndroidAutoVideo.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
            children: [
                {
                    path: '/device-selector',
                    name: 'device-selector',
                    component: AndroidAutoDeviceSelector,
                },
            ],
        },
        {
            path: '/android-auto-video',
            name: 'android-auto-video',
            component: AndroidAutoVideo,
        },
    ],
});

export default router;
