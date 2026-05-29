/* global Vue, APP_STATE, canManage, nextId, timeAgo */
(function () {
const { defineComponent, ref, computed } = Vue;

const TYPE_META = {
  task:     { icon:'✅', label:'Задача',     bg:'#EBF8FF', color:'#2b6cb0' },
  meeting:  { icon:'📢', label:'Собрание',   bg:'#FFFBEB', color:'#b7791f' },
  announce: { icon:'📣', label:'Объявление', bg:'#FAF5FF', color:'#6b46c1' },
  system:   { icon:'⚙️', label:'Система',    bg:'#F0FFF4', color:'#276749' },
};

window.NotificationsView = defineComponent({
  name: 'Notifications',
  setup() {
    const state      = window.APP_STATE;
    const user       = computed(() => state.currentUser);
    const showCreate = ref(false);
    const newNotif   = ref({ type:'announce', title:'', body:'', targets:'all' });

    const sorted = computed(() =>
      [...state.notifications].sort((a, b) => b.time.localeCompare(a.time))
    );

    const unreadCount = computed(() => state.notifications.filter(n => !n.isRead).length);

    function markAll()     { state.notifications.forEach(n => n.isRead = true); }
    function markOne(n)    { n.isRead = true; }

    function createNotif() {
      if (!newNotif.value.title.trim()) return;
      state.notifications.unshift({
        id:       window.nextId(state.notifications),
        type:     newNotif.value.type,
        title:    newNotif.value.title.trim(),
        body:     newNotif.value.body.trim(),
        time:     new Date().toISOString(),
        isRead:   false,
        authorId: user.value.id,
      });
      newNotif.value = { type:'announce', title:'', body:'', targets:'all' };
      showCreate.value = false;
    }

    function removeNotif(id) {
      const idx = state.notifications.findIndex(n => n.id === id);
      if (idx !== -1) state.notifications.splice(idx, 1);
    }

    return {
      user, sorted, unreadCount, showCreate, newNotif, TYPE_META,
      markAll, markOne, createNotif, removeNotif,
      canManage: window.canManage, timeAgo: window.timeAgo,
    };
  },

  template: `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1 class="page-title" style="margin:0;">
          Уведомления
          <span v-if="unreadCount > 0" class="badge badge-navy" style="margin-left:8px; font-size:12px;">{{ unreadCount }}</span>
        </h1>
        <div style="display:flex; gap:8px;">
          <button v-if="unreadCount > 0" class="btn btn-outline btn-sm" @click="markAll">Прочитать все</button>
          <button v-if="canManage(user)" class="btn btn-primary btn-sm" @click="showCreate=true">+ Объявление</button>
        </div>
      </div>

      <div v-if="sorted.length===0" class="empty-state">
        <span class="empty-icon">🔔</span>
        <span class="empty-text">Нет уведомлений</span>
      </div>

      <div class="card" style="padding:0 16px;">
        <div v-for="n in sorted" :key="n.id"
             class="notif-item" :class="{ unread: !n.isRead }"
             @click="markOne(n)">
          <div class="notif-icon-wrap"
               :style="{ background: TYPE_META[n.type]?.bg || '#f0f4fb' }">
            {{ TYPE_META[n.type]?.icon || '📌' }}
          </div>
          <div style="flex:1; min-width:0;">
            <div class="notif-title">{{ n.title }}</div>
            <div class="notif-body">{{ n.body }}</div>
            <div class="notif-time">{{ timeAgo(n.time) }}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
            <div v-if="!n.isRead" class="unread-dot"></div>
            <button v-if="canManage(user)"
                    style="background:none; border:none; color:#c0c8d8; font-size:14px; cursor:pointer;"
                    @click.stop="removeNotif(n.id)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Новое уведомление</h2>
            <button class="modal-close" @click="showCreate=false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Тип</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button v-for="(meta, key) in TYPE_META" :key="key"
                      class="chip" :class="{ active: newNotif.type===key }"
                      @click="newNotif.type=key">
                {{ meta.icon }} {{ meta.label }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Заголовок *</label>
            <input class="form-control" v-model="newNotif.title" placeholder="Планёрка в 18:00">
          </div>
          <div class="form-group">
            <label class="form-label">Текст</label>
            <textarea class="form-control" v-model="newNotif.body" placeholder="Подробности..."></textarea>
          </div>
          <button class="btn btn-primary btn-block" @click="createNotif">Отправить всем</button>
        </div>
      </div>
    </div>
  `,
});
})();
