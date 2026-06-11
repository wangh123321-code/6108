import { createRouter, createWebHistory } from 'vue-router'
import SimulationPage from '@/pages/SimulationPage.vue'

const routes = [
  {
    path: '/',
    name: 'simulation',
    component: SimulationPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
