import { createRouter, createWebHistory } from 'vue-router';
import ClusterView from '../components/ClusterView.vue';

const router = createRouter({
    history: createWebHistory(window.location.pathname),
    routes: [
        {
            path: '/',
            name: 'home',
            component: ClusterView,
        },
    ],
});

export default router;
