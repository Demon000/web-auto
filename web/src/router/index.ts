import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../components/HomeView.vue';
import VideoView from '../components/VideoView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/android-auto-video',
            name: 'android-auto-video',
            component: VideoView,
        },
    ],
});

export default router;
