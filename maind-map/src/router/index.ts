import { createRouter, createWebHistory } from 'vue-router'
import BulletView from '../views/BulletView.vue'
import MindmapView from '../views/MindmapView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/bullet'
    },
    {
      path: '/bullet',
      name: 'bullet',
      component: BulletView,
    },
    {
      path: '/mindmap',
      name: 'mindmap',
      component: MindmapView,
    },
  ],
})

export default router
