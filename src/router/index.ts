import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MapComponent from '@/views/MapView.vue'

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'map',
        component: MapComponent,
    },
    {
        path: '/features',
        name: 'features',
        component: () => import('@/views/FeaturesView.vue'),
    },
    {
        path: '/about',
        name: 'about',
        component: () => import('@/views/AboutView.vue'),
    },
    {
        path: '/settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
    },
    {
        path: '/selection',
        name: 'selection',
        component: () => import('@/views/SelectionView.vue'),
    },
    {
        path: '/processes',
        name: 'processes',
        component: () => import('@/views/ProcessesView.vue'),
    },
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

export default router