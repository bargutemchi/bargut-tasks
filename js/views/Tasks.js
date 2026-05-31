/* global Vue, APP_STATE, APP_USERS, getUser, canManage, formatDate, todayStr */
(function () {
const { defineComponent, ref, computed, onMounted, onUnmounted } = Vue;

window.TasksView = defineComponent({
  name: 'Tasks',
  setup() {
    const db    = window.supabaseClient;
    const state = window.APP_STATE;
    const USERS = window.APP_USERS;
    const user  = computed(() => state.currentUser);

    const filter     = ref('all');
    const showCreate = ref(false);
    const showDetail = ref(null);
    const loadError  = ref(null);
    const saving     = ref(false);

    const newTask = ref({ title:'', desc:'', assigneeId:null, priority:'medium', dept:'general', deadline: window.todayStr() });

    const filters = [
      { key:'all',      label:'Все' },
      { key:'mine',     label:'Мои' },
      { key:'todo',     label:'Ожидают' },
      { key:'progress', label:'В работе' },
      { key:'done',     label:'Готово' },
    ];

    // Маппинг snake_case (Supabase) → camelCase (UI)
    function mapTask(t) {
      return {
        id:         t.id,
        title:      t.title,
        desc:       t.description || '',
        assigneeId: t.assignee_id,
        createdBy:  t.created_by,
        priority:   t.priority   || 'medium',
        status:     t.status     || 'todo',
        dept:       t.dept       || 'general',
        deadline:   t.deadline   || '',
        createdAt:  t.created_at || '',
      };
    }

    let channel = null;

    async function loadTasks() {
      const { data, error } = await db
        .from('tasks').select('*')
        .order('created_at', { ascending: false });
      if (error) { loadError.value = error.message; return; }
      state.tasks = (data || []).map(mapTask);
    }

    function subscribeRealtime() {
      channel = db.channel('public:tasks')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, payload => {
          const exists = state.tasks.find(t => t.id === payload.new.id);
          if (!exists) state.tasks.unshift(mapTask(payload.new));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, payload => {
          const idx = state.tasks.findIndex(t => t.id === payload.new.id);
          if (idx !== -1) state.tasks.splice(idx, 1, mapTask(payload.new));
          if (showDetail.value && showDetail.value.id === payload.new.id)
            showDetail.value = mapTask(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, payload => {
          if (payload.old && payload.old.id)
            state.tasks = state.tasks.filter(t => t.id !== payload.old.id);
        })
        .subscribe();
    }

    onMounted(async () => { await loadTasks(); subscribeRealtime(); });
    onUnmounted(() => { if (channel) db.removeChannel(channel); });

    const visibleTasks = computed(() => {
      let tasks = state.tasks;
      if (!window.canManage(user.value)) {
        tasks = tasks.filter(t => t.assigneeId === user.value.id || t.createdBy === user.value.id);
      }
      if (filter.value === 'mine')     tasks = tasks.filter(t => t.assigneeId === user.value.id);
      if (filter.value === 'todo')     tasks = tasks.filter(t => t.status === 'todo');
      if (filter.value === 'progress') tasks = tasks.filter(t => t.status === 'progress');
      if (filter.value === 'done')     tasks = tasks.filter(t => t.status === 'done');
      return [...tasks].sort((a, b) => {
        const p = { high:0, medium:1, low:2 };
        return (p[a.priority] || 1) - (p[b.priority] || 1);
      });
    });

    const priorityClass = { high:'p-high', medium:'p-medium', low:'p-low' };
    const priorityLabel = { high:'Высокий', medium:'Средний', low:'Низкий' };
    const statusClass   = { todo:'badge-todo', progress:'badge-progress', done:'badge-done' };
    const statusLabel   = { todo:'Ожидает', progress:'В работе', done:'Выполнено' };

    function nextStatus(s) {
      if (s === 'todo')     return 'progress';
      if (s === 'progress') return 'done';
      return 'todo';
    }

    async function advance(task) {
      if (task.assigneeId !== user.value.id && !window.canManage(user.value)) return;
      const { error } = await db.from('tasks')
        .update({ status: nextStatus(task.status), updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) alert('Ошибка: ' + error.message);
    }

    async function createTask() {
      if (!newTask.value.title.trim()) return;
      saving.value = true;
      const { error } = await db.from('tasks').insert({
        title:       newTask.value.title.trim(),
        description: newTask.value.desc.trim(),
        assignee_id: newTask.value.assigneeId || user.value.id,
        created_by:  user.value.id,
        priority:    newTask.value.priority,
        status:      'todo',
        dept:        newTask.value.dept,
        deadline:    newTask.value.deadline || null,
      });
      saving.value = false;
      if (error) { alert('Ошибка создания: ' + error.message); return; }
      newTask.value = { title:'', desc:'', assigneeId:null, priority:'medium', dept:'general', deadline: window.todayStr() };
      showCreate.value = false;
    }

    async function deleteTask(task) {
      const { error } = await db.from('tasks').delete().eq('id', task.id);
      if (error) { alert('Ошибка удаления: ' + error.message); return; }
      showDetail.value = null;
    }

    function isOverdue(task) {
      return task.status !== 'done' && task.deadline && task.deadline < window.todayStr();
    }

    return {
      user, filter, filters, visibleTasks, showCreate, showDetail, newTask, loadError, saving,
      priorityClass, priorityLabel, statusClass, statusLabel,
      advance, createTask, deleteTask,
      getUser: window.getUser, canManage: window.canManage, USERS,
      formatDate: window.formatDate, isOverdue,
    };
  },

  template: `
    <div>
      <div v-if="loadError"
           style="padding:12px 16px; background:#fff5f5; color:#c53030; font-size:13px; border-radius:8px; margin-bottom:12px;">
        ⚠️ Ошибка загрузки задач: {{ loadError }}<br>
        <small>Создайте таблицу tasks в Supabase SQL Editor.</small>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1 class="page-title" style="margin:0;">Задачи</h1>
        <button v-if="canManage(user)" class="btn btn-primary btn-sm" @click="showCreate=true">
          + Создать
        </button>
      </div>

      <div class="tabs">
        <button v-for="f in filters" :key="f.key"
                class="tab" :class="{ active: filter===f.key }"
                @click="filter=f.key">{{ f.label }}</button>
      </div>

      <div v-if="visibleTasks.length===0" class="empty-state">
        <span class="empty-icon">📋</span>
        <span class="empty-text">Задач нет</span>
      </div>

      <div v-for="task in visibleTasks" :key="task.id"
           class="card-sm" style="cursor:pointer;" @click="showDetail=task">
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <div class="priority-dot" :class="priorityClass[task.priority]" style="margin-top:6px;"></div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; color:#1a2a4a; margin-bottom:4px;"
                 :style="{ textDecoration: task.status==='done' ? 'line-through' : 'none', opacity: task.status==='done' ? .6 : 1 }">
              {{ task.title }}
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              <span class="badge" :class="statusClass[task.status]">{{ statusLabel[task.status] }}</span>
              <span v-if="isOverdue(task)" class="badge badge-urgent">Просрочено</span>
              <div class="avatar avatar-sm" :style="{ background: getUser(task.assigneeId)?.color }">
                {{ getUser(task.assigneeId)?.short }}
              </div>
              <span style="font-size:11px; color:#8a9aba;">{{ formatDate(task.deadline) }}</span>
            </div>
          </div>
          <button v-if="task.assigneeId===user.id || canManage(user)"
                  class="btn btn-sm"
                  :class="task.status==='done' ? 'btn-outline' : 'btn-gold'"
                  style="flex-shrink:0; font-size:16px; padding:6px 10px;"
                  @click.stop="advance(task)">
            {{ task.status==='done' ? '↩' : '✓' }}
          </button>
        </div>
      </div>

      <!-- Task Detail Modal -->
      <teleport to="body">
        <div v-if="showDetail" class="modal-overlay" @click.self="showDetail=null">
          <div class="modal-sheet">
            <div class="modal-header">
              <h2 class="modal-title">Задача</h2>
              <button class="modal-close" @click="showDetail=null">✕</button>
            </div>
            <div>
              <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                <span class="badge" :class="statusClass[showDetail.status]">{{ statusLabel[showDetail.status] }}</span>
                <span class="badge"
                      :style="{ background: showDetail.priority==='high'?'#FFF5F5':showDetail.priority==='medium'?'#FFFBEB':'#F0FFF4',
                                color: showDetail.priority==='high'?'#c53030':showDetail.priority==='medium'?'#b7791f':'#276749' }">
                  {{ priorityLabel[showDetail.priority] }} приоритет
                </span>
              </div>
              <h3 style="font-size:17px; font-weight:700; color:#1a2a4a; margin-bottom:8px;">{{ showDetail.title }}</h3>
              <p v-if="showDetail.desc"
                 style="font-size:14px; color:#4a5a7a; line-height:1.6; margin-bottom:12px;">{{ showDetail.desc }}</p>
              <div style="font-size:13px; color:#4a5a7a; margin-bottom:6px;">
                👤 Исполнитель: <strong>{{ getUser(showDetail.assigneeId)?.name }}</strong>
              </div>
              <div style="font-size:13px; color:#4a5a7a; margin-bottom:6px;">
                📅 Срок: <strong>{{ showDetail.deadline }}</strong>
              </div>
              <div style="font-size:13px; color:#4a5a7a; margin-bottom:20px;">
                ✍️ Создал: <strong>{{ getUser(showDetail.createdBy)?.name }}</strong>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button v-if="showDetail.status !== 'done' && (showDetail.assigneeId===user.id || canManage(user))"
                        class="btn btn-gold" @click="advance(showDetail); showDetail=null">
                  ✓ Взять в работу / Выполнено
                </button>
                <button v-if="canManage(user)" class="btn btn-danger btn-sm" @click="deleteTask(showDetail)">
                  🗑 Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      </teleport>

      <!-- Create Task Modal -->
      <teleport to="body">
        <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
          <div class="modal-sheet">
            <div class="modal-header">
              <h2 class="modal-title">Новая задача</h2>
              <button class="modal-close" @click="showCreate=false">✕</button>
            </div>
            <div class="form-group">
              <label class="form-label">Название *</label>
              <input class="form-control" v-model="newTask.title" placeholder="Что нужно сделать?">
            </div>
            <div class="form-group">
              <label class="form-label">Описание</label>
              <textarea class="form-control" v-model="newTask.desc" placeholder="Подробности..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Исполнитель</label>
              <select class="form-control" v-model="newTask.assigneeId">
                <option :value="null">Выберите сотрудника</option>
                <option v-for="u in USERS" :key="u.id" :value="u.id">{{ u.name }} — {{ u.roleLabel }}</option>
              </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Приоритет</label>
                <select class="form-control" v-model="newTask.priority">
                  <option value="high">🔴 Высокий</option>
                  <option value="medium">🟡 Средний</option>
                  <option value="low">🟢 Низкий</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Срок</label>
                <input type="date" class="form-control" v-model="newTask.deadline">
              </div>
            </div>
            <button class="btn btn-primary btn-block" :disabled="saving" @click="createTask">
              {{ saving ? 'Сохраняем...' : 'Создать задачу' }}
            </button>
          </div>
        </div>
      </teleport>
    </div>
  `,
});
})();
