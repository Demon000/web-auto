import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../components/HomeView.vue';
import VideoView from '../components/VideoView.vue';
import ConnectionsView from '../components/ConnectionsView.vue';

const router = createRouter({
    history: createWebHistory('/'),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/connections',
            name: 'connections',
            component: ConnectionsView,
        },
        {
            path: '/android-auto-video',
            name: 'android-auto-video',
            component: VideoView,
        },
    ],
});

export default router;
