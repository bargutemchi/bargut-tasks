/* global Vue, VueRouter, APP_STATE, APP_USERS, canManage */
(function () {
const { createApp, defineComponent, ref, computed, watch } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

const state = window.APP_STATE;

// Загружаем сотрудников из Supabase при старте
window.refreshUsers && window.refreshUsers();

// Регистрируем Service Worker сразу
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    window.PushMgr && window.PushMgr.registerSW();
  });
}

// ── Router ──────────────────────────────────────────────────
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path:'/',              component: window.LoginView,        meta:{ public:true } },
    { path:'/dashboard',     component: window.DashboardView },
    { path:'/tasks',         component: window.TasksView },
    { path:'/schedule',      component: window.ScheduleView },
    { path:'/cash',          component: window.CashView },
    { path:'/phyto',         component: window.PhytoView },
    { path:'/chat',          component: window.ChatView },
    { path:'/documents',     component: window.DocumentsView },
    { path:'/notifications', component: window.NotificationsView },
    { path:'/departments',   component: window.DepartmentsView },
    { path:'/employees',     component: window.EmployeesView },
    { path:'/:pathMatch(.*)*', redirect:'/' },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.public && !state.currentUser) return '/';
  if (to.path === '/' && state.currentUser) return '/dashboard';
});

// ── Nav config ──────────────────────────────────────────────
const NAV_MAIN = [
  { path:'/dashboard', icon:'🏠', label:'Главная' },
  { path:'/tasks',     icon:'✅', label:'Задачи' },
  { path:'/chat',      icon:'💬', label:'Чат' },
  { path:'/more',      icon:'⋯',  label:'Ещё' },
];

const NAV_MORE = [
  { path:'/cash',          icon:'💰', label:'Касса' },
  { path:'/phyto',         icon:'📦', label:'Склад Фито' },
  { path:'/documents',     icon:'📁', label:'Документы' },
  { path:'/notifications', icon:'🔔', label:'Уведомления' },
  { path:'/departments',   icon:'🏢', label:'Отделы' },
  { path:'/employees',     icon:'👥', label:'Сотрудники' },
];

// ── Root App ─────────────────────────────────────────────────
const App = defineComponent({
  setup() {
    const showMore    = ref(false);
    const currentRoute = computed(() => router.currentRoute.value.path);
    const isLoggedIn  = computed(() => !!state.currentUser);
    const user        = computed(() => state.currentUser);
    const unread      = computed(() => state.notifications.filter(n => !n.isRead).length);

    function navTo(path) {
      showMore.value = false;
      if (path === '/more') { showMore.value = true; return; }
      router.push(path);
    }

    // Запуск presence и push при входе/выходе
    watch(() => state.currentUser, (u) => {
      if (u) {
        window.Presence && window.Presence.startPresence(u.id);
      } else {
        window.Presence && window.Presence.stopPresence();
      }
    }, { immediate: true });

    function logout() {
      window.Presence && window.Presence.stopPresence();
      state.currentUser = null;
      router.push('/');
    }

    async function forceUpdate() {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
      window.location.reload(true);
    }

    function isActive(path) {
      if (path === '/more') return NAV_MORE.some(n => currentRoute.value.startsWith(n.path));
      return currentRoute.value.startsWith(path);
    }

    return { showMore, currentRoute, isLoggedIn, user, unread,
             navTo, logout, isActive, NAV_MAIN, NAV_MORE, forceUpdate };
  },

  template: `
    <div v-if="!isLoggedIn" id="login-root">
      <router-view />
    </div>

    <div v-else class="app-shell">
      <header class="app-header">
        <div class="logo-text">
          Баргут Эмчи
          <span class="logo-sub">Корпоративный портал</span>
        </div>
        <div class="header-notif" @click="navTo('/notifications')">
          🔔
          <div v-if="unread > 0" class="notif-badge"></div>
        </div>
        <div class="header-notif" @click="forceUpdate" title="Обновить приложение">🔄</div>
        <div class="header-user" @click="logout" title="Выйти">
          <div class="avatar" :style="{ background: user.color }">{{ user.short }}</div>
        </div>
      </header>

      <div class="app-body">
        <main class="app-content">
          <router-view v-slot="{ Component }">
            <transition name="view" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>
      </div>

      <nav class="bottom-nav">
        <div v-for="item in NAV_MAIN" :key="item.path"
             class="nav-item" :class="{ active: isActive(item.path) }"
             @click="navTo(item.path)">
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </nav>

      <template v-if="showMore">
        <div class="drawer-overlay" @click="showMore = false"></div>
        <div class="more-menu">
          <div class="more-menu-grid">
            <div v-for="item in NAV_MORE" :key="item.path"
                 class="more-menu-item" @click="navTo(item.path)">
              <span class="mi-icon">{{ item.icon }}</span>
              <span class="mi-label">{{ item.label }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  `,
});

// ── Mount ────────────────────────────────────────────────────
const app = createApp(App);
app.use(router);
app.mount('#app');
})();
