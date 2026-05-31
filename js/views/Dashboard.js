/* global Vue, VueRouter, APP_STATE, getUser, canManage, todayStr, formatDate */
(function () {
const { defineComponent, computed } = Vue;
const { useRouter } = VueRouter;

window.DashboardView = defineComponent({
  name: 'Dashboard',
  setup() {
    const router = useRouter();
    const state  = window.APP_STATE;
    const user   = computed(() => state.currentUser);
    const today  = window.todayStr();

    const myTasks = computed(() =>
      state.tasks.filter(t =>
        t.status !== 'done' &&
        (t.assigneeId === user.value.id || window.canManage(user.value))
      ).slice(0, 5)
    );

    const todayShifts = computed(() =>
      state.shifts.filter(s => s.date === today).slice(0, 6)
    );

    const unreadNotifs = computed(() =>
      state.notifications.filter(n => !n.isRead).slice(0, 3)
    );

    const totalIncome = computed(() =>
      state.transactions
        .filter(t => t.date === today && t.type === 'income')
        .reduce((s, t) => s + t.amount, 0)
    );

    const taskStats = computed(() => ({
      todo:     state.tasks.filter(t => t.status === 'todo').length,
      progress: state.tasks.filter(t => t.status === 'progress').length,
      done:     state.tasks.filter(t => t.status === 'done').length,
    }));

    const dayOfWeek = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const months    = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const now       = new Date();
    const dateLabel = `${dayOfWeek[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

    const priorityClass = { high:'p-high', medium:'p-medium', low:'p-low' };
    const statusLabel   = { todo:'Ожидает', progress:'В работе', done:'Выполнено' };
    const notifIcon     = { task:'✅', meeting:'📢', announce:'📣', system:'⚙️' };

    return {
      user, myTasks, todayShifts, unreadNotifs, totalIncome,
      taskStats, dateLabel, priorityClass, statusLabel, notifIcon,
      getUser: window.getUser, canManage: window.canManage, formatDate: window.formatDate, router,
    };
  },

  template: `
    <div>
      <!-- Greeting -->
      <div class="card-navy" style="margin-bottom:16px;">
        <p style="color:rgba(247,216,148,.7); font-size:12px; margin-bottom:4px;">{{ dateLabel }}</p>
        <h2 style="font-size:20px; font-weight:700; color:#f7d894; margin-bottom:2px;">
          Добро пожаловать, {{ user.name }}!
        </h2>
        <p style="font-size:13px; color:rgba(255,255,255,.7);">{{ user.roleLabel }}</p>
      </div>

      <!-- Stats (only for owner/admin) -->
      <template v-if="canManage(user)">
        <div class="stats-row" style="grid-template-columns:repeat(2,1fr);">
          <div class="stat-card">
            <div class="stat-value" style="color:#e53e3e;">{{ taskStats.todo }}</div>
            <div class="stat-label">Ожидают</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:#dd6b20;">{{ taskStats.progress }}</div>
            <div class="stat-label">В работе</div>
          </div>
        </div>
      </template>


    </div>
  `,
});
})();
