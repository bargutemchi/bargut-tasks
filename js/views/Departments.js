/* global Vue, APP_STATE, getUser, canManage, nextId */
const { defineComponent, ref, computed } = Vue;

const DEPT_TABS = [
  { key:'advertising', icon:'📢', label:'Реклама' },
  { key:'sales',       icon:'📈', label:'Продажи' },
  { key:'marketing',   icon:'🎯', label:'Маркетинг' },
  { key:'strategy',    icon:'🏆', label:'Стратегии' },
];

const STATUS_META = {
  active: { label:'Активный', cls:'badge-done' },
  draft:  { label:'Черновик', cls:'badge-todo' },
  done:   { label:'Завершён', cls:'badge-navy' },
};

window.DepartmentsView = defineComponent({
  name: 'Departments',
  setup() {
    const state   = window.APP_STATE;
    const user    = computed(() => state.currentUser);
    const dept    = ref('advertising');
    const showAdd = ref(false);
    const newPlan = ref({ title:'', content:'', status:'active' });

    const deptTasks = computed(() =>
      state.tasks.filter(t => {
        if (dept.value === 'advertising') return t.dept === 'advertising';
        if (dept.value === 'sales')       return t.dept === 'sales';
        if (dept.value === 'marketing')   return t.dept === 'advertising' || t.dept === 'marketing';
        return true;
      }).filter(t => t.status !== 'done').slice(0, 6)
    );

    const deptPlans = computed(() =>
      state.plans
        .filter(p => p.dept === dept.value)
        .sort((a, b) => b.date.localeCompare(a.date))
    );

    const kpis = computed(() => {
      const totalIncome = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalTasks  = state.tasks.length;
      const doneTasks   = state.tasks.filter(t => t.status === 'done').length;

      if (dept.value === 'advertising') return [
        { value:'12',   label:'Постов в месяц',  change:'+3',   up:true  },
        { value:'2.4K', label:'Охват аудитории', change:'+15%', up:true  },
        { value:'3',    label:'Кампании',         change:'',     up:null  },
        { value:'87%',  label:'Выполнение плана', change:'',     up:null  },
      ];
      if (dept.value === 'sales') return [
        { value: totalIncome.toLocaleString('ru').slice(0, 4)+'K', label:'Выручка этой нед.', change:'+12%', up:true  },
        { value:'18',  label:'Звонков сегодня',  change:'+5',   up:true  },
        { value:'35%', label:'Конверсия',         change:'-2%',  up:false },
        { value:'142', label:'Клиентов в базе',   change:'+8',   up:true  },
      ];
      if (dept.value === 'marketing') return [
        { value:'4.7⭐', label:'Средний рейтинг', change:'+0.2', up:true  },
        { value:'28',   label:'Новых отзывов',    change:'+5',   up:true  },
        { value:'320',  label:'Цель клиентов/мес',change:'',     up:null  },
        { value:'76%',  label:'Повторных визитов', change:'+4%', up:true  },
      ];
      return [
        { value: doneTasks+'/'+totalTasks, label:'Задачи выполнены',   change:'', up:null },
        { value:'2',   label:'OKR активных',       change:'', up:null },
        { value:'5M₽', label:'Цель выручки в год', change:'', up:null },
        { value:'Q2',  label:'Текущий квартал',     change:'', up:null },
      ];
    });

    function addPlan() {
      if (!newPlan.value.title.trim()) return;
      state.plans.push({
        id:       window.nextId(state.plans),
        dept:     dept.value,
        title:    newPlan.value.title.trim(),
        content:  newPlan.value.content.trim(),
        status:   newPlan.value.status,
        authorId: user.value.id,
        date:     new Date().toLocaleDateString('ru-RU'),
      });
      newPlan.value = { title:'', content:'', status:'active' };
      showAdd.value = false;
    }

    function removePlan(id) {
      const idx = state.plans.findIndex(p => p.id === id);
      if (idx !== -1) state.plans.splice(idx, 1);
    }

    function toggleStatus(plan) {
      const cycle = ['active','done','draft'];
      plan.status = cycle[(cycle.indexOf(plan.status) + 1) % cycle.length];
    }

    const priorityClass = { high:'p-high', medium:'p-medium', low:'p-low' };
    const statusLabel   = { todo:'Ожидает', progress:'В работе', done:'Выполнено' };

    return {
      user, dept, deptTasks, deptPlans, kpis,
      showAdd, newPlan, DEPT_TABS, STATUS_META,
      addPlan, removePlan, toggleStatus,
      getUser: window.getUser, canManage: window.canManage,
      priorityClass, statusLabel,
    };
  },

  template: `
    <div>
      <h1 class="page-title">Отделы</h1>

      <div class="tabs">
        <button v-for="t in DEPT_TABS" :key="t.key"
                class="tab" :class="{ active: dept===t.key }"
                @click="dept=t.key">{{ t.icon }} {{ t.label }}</button>
      </div>

      <div class="dept-kpi-row">
        <div v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
          <div class="kpi-value">{{ kpi.value }}</div>
          <div class="kpi-label">{{ kpi.label }}</div>
          <div v-if="kpi.change" class="kpi-change"
               :class="kpi.up===true ? 'kpi-up' : kpi.up===false ? 'kpi-down' : ''">
            {{ kpi.up===true ? '▲' : kpi.up===false ? '▼' : '' }} {{ kpi.change }}
          </div>
        </div>
      </div>

      <div class="section-title">Активные задачи</div>
      <div class="card" style="padding:8px 16px;">
        <div v-if="deptTasks.length===0"
             style="padding:12px 0; text-align:center; color:#8a9aba; font-size:13px;">
          Нет активных задач в этом отделе
        </div>
        <div v-for="task in deptTasks" :key="task.id" class="list-item">
          <div class="priority-dot" :class="priorityClass[task.priority]" style="margin-top:5px;"></div>
          <div class="list-item-body">
            <div class="list-item-title">{{ task.title }}</div>
            <div class="list-item-meta">
              <span class="badge badge-todo">{{ statusLabel[task.status] }}</span>
              <div class="avatar avatar-sm" :style="{ background: getUser(task.assigneeId)?.color }">
                {{ getUser(task.assigneeId)?.short }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div class="section-title" style="margin-top:20px;">
          {{ dept==='strategy' ? 'Стратегии и OKR' : 'Планы и материалы' }}
        </div>
        <button v-if="canManage(user)" class="btn btn-primary btn-sm" style="flex-shrink:0;" @click="showAdd=true">
          + Добавить
        </button>
      </div>

      <div v-if="deptPlans.length===0" class="empty-state" style="padding:32px;">
        <span class="empty-icon">📋</span>
        <span class="empty-text">Планов пока нет</span>
      </div>

      <div v-for="plan in deptPlans" :key="plan.id" class="card-sm">
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px; flex-wrap:wrap;">
              <span class="badge" :class="STATUS_META[plan.status]?.cls">
                {{ STATUS_META[plan.status]?.label }}
              </span>
              <span style="font-size:11px; color:#8a9aba;">{{ plan.date }}</span>
            </div>
            <div style="font-size:14px; font-weight:700; color:#1a2a4a; margin-bottom:4px;">{{ plan.title }}</div>
            <div style="font-size:12px; color:#4a5a7a; line-height:1.5;">{{ plan.content }}</div>
          </div>
          <div v-if="canManage(user)" style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
            <button class="btn btn-outline btn-sm" @click="toggleStatus(plan)"
                    style="padding:4px 8px; font-size:11px;">↻</button>
            <button style="background:none; border:none; color:#c0c8d8; cursor:pointer; font-size:14px;"
                    @click="removePlan(plan.id)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="showAdd" class="modal-overlay" @click.self="showAdd=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Новый план</h2>
            <button class="modal-close" @click="showAdd=false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Название *</label>
            <input class="form-control" v-model="newPlan.title" placeholder="Контент-план на июнь">
          </div>
          <div class="form-group">
            <label class="form-label">Описание / содержание</label>
            <textarea class="form-control" v-model="newPlan.content" rows="3"
                      placeholder="Ключевые пункты плана..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Статус</label>
            <select class="form-control" v-model="newPlan.status">
              <option value="active">Активный</option>
              <option value="draft">Черновик</option>
              <option value="done">Завершён</option>
            </select>
          </div>
          <button class="btn btn-primary btn-block" @click="addPlan">Сохранить</button>
        </div>
      </div>
    </div>
  `,
});
