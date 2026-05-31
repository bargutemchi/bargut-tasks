/* global Vue, APP_STATE, APP_USERS, canManage */
(function () {
const { defineComponent, ref, computed, reactive } = Vue;

const COLORS = [
  '#08205e','#0d2d7a','#1a3d8a','#1a5a6a','#2a6a5a',
  '#4a5a8a','#5a4a8a','#6a3a7a','#7a4a3a','#3a5a6a',
  '#38a169','#c05621','#b7791f','#2c7a7b','#702459',
];

const ROLES = [
  { value:'owner', label:'Владелец' },
  { value:'admin', label:'Администратор' },
  { value:'staff', label:'Сотрудник' },
];

const DEPTS = [
  { value:'',            label:'— Нет —' },
  { value:'medical',     label:'Медицинский' },
  { value:'admin',       label:'Администрация' },
  { value:'advertising', label:'Реклама' },
  { value:'sales',       label:'Продажи' },
  { value:'supply',      label:'Закупки' },
  { value:'finance',     label:'Финансы' },
];

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

window.EmployeesView = defineComponent({
  name: 'Employees',

  setup() {
    const db      = window.supabaseClient;
    const state   = window.APP_STATE;
    const user    = computed(() => state.currentUser);
    const isOwner = computed(() => user.value?.role === 'owner');

    const employees = ref([]);
    const loading   = ref(false);
    const showForm  = ref(false);
    const saving    = ref(false);
    const formError = ref('');

    const form = reactive({
      name: '', short: '', role: 'staff', role_label: '',
      dept: '', color: '#4a5a8a', login: '', password: '',
    });

    async function loadEmployees() {
      loading.value = true;
      const { data } = await db.from('employees').select('*').eq('is_active', true).order('id');
      employees.value = data || [];
      loading.value = false;
    }

    loadEmployees();

    function openForm() {
      Object.assign(form, { name:'', short:'', role:'staff', role_label:'', dept:'', color:'#4a5a8a', login:'', password:'' });
      formError.value = '';
      showForm.value  = true;
    }

    function autoShort() {
      if (!form.name) return;
      const parts = form.name.trim().split(' ');
      form.short = parts.map(p => p[0] || '').join('').toUpperCase().slice(0, 2);
    }

    async function saveEmployee() {
      formError.value = '';
      if (!form.name.trim())       { formError.value = 'Введите имя'; return; }
      if (!form.short.trim())      { formError.value = 'Введите аббревиатуру'; return; }
      if (!form.role_label.trim()) { formError.value = 'Введите должность'; return; }
      if (!form.login.trim())      { formError.value = 'Введите логин'; return; }
      if (form.password.length < 4){ formError.value = 'Пароль минимум 4 символа'; return; }

      saving.value = true;
      try {
        // 1. Добавляем в employees
        const { data: emp, error: empErr } = await db.from('employees').insert({
          name:       form.name.trim(),
          short:      form.short.trim().toUpperCase(),
          role:       form.role,
          role_label: form.role_label.trim(),
          dept:       form.dept || null,
          color:      form.color,
          is_active:  true,
        }).select().single();

        if (empErr) throw empErr;

        // 2. Добавляем логин/пароль в staff
        const hash = await sha256hex(form.password);
        const { error: staffErr } = await db.from('staff').insert({
          user_id:       emp.id,
          login:         form.login.trim().toLowerCase(),
          password_hash: hash,
        });

        if (staffErr) throw staffErr;

        showForm.value = false;
        await loadEmployees();

        // Обновляем глобальный список пользователей
        window.refreshUsers && window.refreshUsers();
      } catch (e) {
        formError.value = e.message || 'Ошибка сохранения';
      } finally {
        saving.value = false;
      }
    }

    async function deactivate(emp) {
      if (!confirm(`Удалить сотрудника «${emp.name}»?\nДоступ будет закрыт.`)) return;
      await db.from('employees').update({ is_active: false }).eq('id', emp.id);
      await db.from('staff').delete().eq('user_id', emp.id);
      await loadEmployees();
      window.refreshUsers && window.refreshUsers();
    }

    async function resetPassword(emp) {
      const pwd = prompt(`Новый пароль для «${emp.name}»:`);
      if (!pwd || pwd.length < 4) { alert('Пароль минимум 4 символа'); return; }
      const hash = await sha256hex(pwd);
      await db.from('staff').update({ password_hash: hash }).eq('user_id', emp.id);
      alert('Пароль обновлён ✓');
    }

    return {
      employees, loading, showForm, saving, formError,
      form, isOwner, COLORS, ROLES, DEPTS,
      openForm, saveEmployee, autoShort, deactivate, resetPassword,
    };
  },

  template: `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <div class="page-title" style="margin-bottom:0;">Сотрудники</div>
        <button v-if="isOwner" class="btn btn-primary btn-sm" @click="openForm">+ Добавить</button>
      </div>

      <!-- Список -->
      <div v-if="loading" style="text-align:center; padding:32px; color:#8a9aba;">Загрузка...</div>

      <div v-else class="card" style="padding:8px 16px;">
        <div v-if="employees.length === 0"
             style="text-align:center; padding:32px; color:#8a9aba; font-size:14px;">
          Нет сотрудников
        </div>

        <div v-for="emp in employees" :key="emp.id" class="list-item">
          <div class="avatar" :style="{ background: emp.color }">{{ emp.short }}</div>
          <div class="list-item-body">
            <div class="list-item-title">{{ emp.name }}</div>
            <div class="list-item-sub">{{ emp.role_label }}<span v-if="emp.dept"> · {{ emp.dept }}</span></div>
          </div>
          <div v-if="isOwner && emp.role !== 'owner'"
               style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn btn-outline btn-sm" @click="resetPassword(emp)" title="Сменить пароль">🔑</button>
            <button class="btn btn-danger btn-sm" @click="deactivate(emp)" title="Удалить">✕</button>
          </div>
        </div>
      </div>

      <!-- Форма добавления -->
      <div v-if="showForm" class="modal-overlay" @click.self="showForm=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <div class="modal-title">Новый сотрудник</div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveEmployee">
                {{ saving ? '⏳' : 'Сохранить' }}
              </button>
              <button class="modal-close" @click="showForm=false">✕</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Полное имя</label>
            <input class="form-control" v-model="form.name" placeholder="Иванов Иван Иванович"
                   @blur="autoShort">
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Аббревиатура</label>
              <input class="form-control" v-model="form.short" placeholder="ИИ" maxlength="2">
            </div>
            <div class="form-group">
              <label class="form-label">Роль</label>
              <select class="form-control" v-model="form.role">
                <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Должность</label>
            <input class="form-control" v-model="form.role_label" placeholder="Менеджер по закупкам">
          </div>

          <div class="form-group">
            <label class="form-label">Отдел</label>
            <select class="form-control" v-model="form.dept">
              <option v-for="d in DEPTS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Цвет аватара</label>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;">
              <div v-for="c in COLORS" :key="c"
                   @click="form.color=c"
                   :style="{
                     width:'32px', height:'32px', borderRadius:'50%',
                     background:c, cursor:'pointer',
                     outline: form.color===c ? '3px solid #f7d894' : '2px solid transparent',
                     outlineOffset:'2px'
                   }"></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <div :style="{ width:'28px', height:'28px', borderRadius:'50%', background:form.color, flexShrink:0 }"></div>
              <span style="font-size:12px; color:#4a5a7a;">Предпросмотр аватара: </span>
              <div class="avatar" :style="{ background:form.color }">{{ form.short || '?' }}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Логин</label>
              <input class="form-control" v-model="form.login" placeholder="ivanov"
                     autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">Пароль</label>
              <input class="form-control" type="password" v-model="form.password"
                     placeholder="Минимум 4 символа" autocomplete="new-password">
            </div>
          </div>

          <div v-if="formError"
               style="color:#e53e3e; font-size:13px; margin-bottom:12px; text-align:center;">
            {{ formError }}
          </div>

          <button class="btn btn-primary btn-block" :disabled="saving" @click="saveEmployee">
            {{ saving ? 'Сохранение...' : 'Добавить сотрудника' }}
          </button>
        </div>
      </div>
    </div>
  `,
});
})();
