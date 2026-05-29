/* global Vue, VueRouter, APP_STATE, getUser, canManage, todayStr, formatDate */
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
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-value" style="color:#e53e3e;">{{ taskStats.todo }}</div>
            <div class="stat-label">Ожидают</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:#dd6b20;">{{ taskStats.progress }}</div>
            <div class="stat-label">В работе</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:#08205e;">{{ totalIncome.toLocaleString('ru') }}₽</div>
            <div class="stat-label">Выручка сегодня</div>
          </div>
        </div>
      </template>

      <!-- My tasks -->
      <div class="section-title">Мои задачи</div>
      <div class="card" style="padding:8px 16px;">
        <div v-if="myTasks.length === 0" class="empty-state" style="padding:24px;">
          <span class="empty-icon">✅</span>
          <span class="empty-text">Нет активных задач</span>
        </div>
        <div v-for="task in myTasks" :key="task.id"
             class="list-item" @click="router.push('/tasks')">
          <div class="priority-dot" :class="priorityClass[task.priority]" style="margin-top:5px;"></div>
          <div class="list-item-body">
            <div class="list-item-title">{{ task.title }}</div>
            <div class="list-item-meta">
              <span class="badge" :class="task.status==='todo' ? 'badge-todo' : 'badge-progress'">
                {{ statusLabel[task.status] }}
              </span>
              <span style="font-size:11px; color:#8a9aba;">до {{ formatDate(task.deadline) }}</span>
            </div>
          </div>
          <span style="color:#c0c8d8;">›</span>
        </div>
        <div @click="router.push('/tasks')"
             style="text-align:center; padding:10px 0; color:#08205e; font-size:13px; font-weight:600; cursor:pointer;">
          Все задачи →
        </div>
      </div>

      <!-- Today shifts -->
      <div class="section-title">Дежурства сегодня</div>
      <div class="card" style="padding:8px 16px;">
        <div v-if="todayShifts.length === 0" class="empty-state" style="padding:24px;">
          <span class="empty-icon">📅</span>
          <span class="empty-text">Нет дежурств</span>
        </div>
        <div v-for="s in todayShifts" :key="s.id" class="list-item">
          <div class="avatar avatar-sm" :style="{ background: getUser(s.userId)?.color }">
            {{ getUser(s.userId)?.short }}
          </div>
          <div class="list-item-body">
            <div class="list-item-title">{{ getUser(s.userId)?.name }}</div>
            <div class="list-item-sub">{{ s.start }} – {{ s.end }} · {{ s.room }}</div>
          </div>
        </div>
        <div @click="router.push('/schedule')"
             style="text-align:center; padding:10px 0; color:#08205e; font-size:13px; font-weight:600; cursor:pointer;">
          Расписание →
        </div>
      </div>

      <!-- Notifications -->
      <div class="section-title">Уведомления</div>
      <div class="card" style="padding:8px 16px;">
        <div v-if="unreadNotifs.length === 0"
             style="padding:12px 0; text-align:center; color:#8a9aba; font-size:13px;">
          Новых уведомлений нет
        </div>
        <div v-for="n in unreadNotifs" :key="n.id" class="list-item">
          <span style="font-size:20px;">{{ notifIcon[n.type] || '📌' }}</span>
          <div class="list-item-body">
            <div class="list-item-title">{{ n.title }}</div>
            <div class="list-item-sub">{{ n.body }}</div>
          </div>
          <div class="unread-dot"></div>
        </div>
        <div @click="router.push('/notifications')"
             style="text-align:center; padding:10px 0; color:#08205e; font-size:13px; font-weight:600; cursor:pointer;">
          Все уведомления →
        </div>
      </div>
    </div>
  `,
});
