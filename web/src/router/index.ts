import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';
import { WEB_CONFIG } from '../config.js';

const routes: RouteRecordRaw[] = [];

for (const config of WEB_CONFIG.views) {
    routes.push({
        path: config.path,
        component: () => import(`../components/views/${config.component}.vue`),
        props: config,
    });
}

const router = createRouter({
    history: createWebHistory('/'),
    routes,
});

export default router;
