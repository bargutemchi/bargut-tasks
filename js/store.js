/* global Vue */
(function () {
const { reactive, watch } = Vue;

// ── Справочник сотрудников ─────────────────────────────────
const USERS = [
  { id:1, name:'Руслан Цыдыпович', short:'Р', role:'owner', roleLabel:'Ген. директор', dept:null, color:'#08205e' },
];

// ── Демо-данные ─────────────────────────────────────────────
const today = new Date();
const fmt   = (d) => d.toISOString().split('T')[0];
const days  = (n) => fmt(new Date(today.getTime() + n * 86400000));

const DEMO_TASKS = [
  { id:1, title:'Обновить прайс-лист на сайте',        desc:'Добавить новые услуги и скорректировать цены', assigneeId:1, createdBy:1, priority:'medium', status:'todo',     dept:'admin', deadline:days(2), createdAt:days(-1) },
  { id:2, title:'Подготовить отчёт по выручке за май', desc:'Сводная таблица по всем видам услуг',          assigneeId:1, createdBy:1, priority:'high',   status:'progress', dept:'admin', deadline:days(1), createdAt:days(-2) },
];

const DEMO_SHIFTS = [
  { id:1, userId:1, date:days(0), start:'09:00', end:'20:00', room:'Кабинет директора', note:'' },
  { id:2, userId:1, date:days(1), start:'09:00', end:'20:00', room:'Кабинет директора', note:'' },
];

const DEMO_TRANSACTIONS = [
  { id:1, type:'income',  amount:3300, service:'Массаж комплексный', patient:'Петрова А.',  cashierId:1, date:days(0),  time:'09:15', comment:'' },
  { id:2, type:'income',  amount:1500, service:'Иглоукалывание',     patient:'Иванов П.',   cashierId:1, date:days(0),  time:'10:30', comment:'' },
  { id:3, type:'expense', amount:500,  service:'Расходники',          patient:'',            cashierId:1, date:days(0),  time:'13:00', comment:'Закупка расходников' },
];

const DEMO_PHYTO = [
  { id:1,  name:'Агар-35',    qty:8,  minQty:5, unit:'уп', price:1400, category:'Нервная система' },
  { id:2,  name:'Сугмэл-10',  qty:3,  minQty:5, unit:'уп', price:900,  category:'Комплексный' },
  { id:3,  name:'Танчен-25',  qty:12, minQty:5, unit:'уп', price:1500, category:'Детокс' },
  { id:4,  name:'Жуган-25',   qty:6,  minQty:3, unit:'уп', price:850,  category:'Лёгкие' },
  { id:5,  name:'Ванлаг-37',  qty:2,  minQty:4, unit:'уп', price:3650, category:'Сосуды' },
  { id:6,  name:'Арур-10',    qty:15, minQty:5, unit:'уп', price:900,  category:'Пищеварение' },
];

const DEMO_MESSAGES      = [];
const DEMO_NOTIFICATIONS = [];
const DEMO_DOCUMENTS     = [];
const DEMO_PLANS         = [];

// ── Хранилище ─────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveLS(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

const state = reactive({
  currentUser:   loadLS('be3_user',   null),
  tasks:         loadLS('be3_tasks',  DEMO_TASKS),
  shifts:        loadLS('be3_shifts', DEMO_SHIFTS),
  transactions:  loadLS('be3_tx',     DEMO_TRANSACTIONS),
  phyto:         loadLS('be3_phyto',  DEMO_PHYTO),
  messages:      loadLS('be3_msgs',   DEMO_MESSAGES),
  notifications: loadLS('be3_notifs', DEMO_NOTIFICATIONS),
  documents:     loadLS('be3_docs',   DEMO_DOCUMENTS),
  plans:         loadLS('be3_plans',  DEMO_PLANS),
});

watch(() => state.currentUser,   v => saveLS('be3_user',   v));
watch(() => state.tasks,         v => saveLS('be3_tasks',  v), { deep:true });
watch(() => state.shifts,        v => saveLS('be3_shifts', v), { deep:true });
watch(() => state.transactions,  v => saveLS('be3_tx',     v), { deep:true });
watch(() => state.phyto,         v => saveLS('be3_phyto',  v), { deep:true });
watch(() => state.messages,      v => saveLS('be3_msgs',   v), { deep:true });
watch(() => state.notifications, v => saveLS('be3_notifs', v), { deep:true });
watch(() => state.documents,     v => saveLS('be3_docs',   v), { deep:true });
watch(() => state.plans,         v => saveLS('be3_plans',  v), { deep:true });

// ── Хелперы ───────────────────────────────────────────────────
function getUser(id)     { return USERS.find(u => u.id === id) || null; }
function canManage(user) { return user && ['owner','admin'].includes(user.role); }
function nextId(arr)     { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr)) / 1000;
  if (diff < 60)    return 'только что';
  if (diff < 3600)  return Math.floor(diff / 60) + ' мин';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч';
  return Math.floor(diff / 86400) + ' д';
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
}

function formatTime(str) {
  if (!str) return '';
  return new Date(str).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

function todayStr() { return fmt(new Date()); }

async function refreshUsers() {
  if (!window.supabaseClient) return;
  const { data } = await window.supabaseClient
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .order('id');
  if (data && data.length > 0) {
    const mapped = data.map(e => ({
      id: e.id, name: e.name, short: e.short,
      role: e.role, roleLabel: e.role_label,
      dept: e.dept, color: e.color,
    }));
    USERS.splice(0, USERS.length, ...mapped);
  }
}

window.APP_STATE   = state;
window.APP_USERS   = USERS;
window.refreshUsers = refreshUsers;
window.getUser    = getUser;
window.canManage  = canManage;
window.nextId     = nextId;
window.timeAgo    = timeAgo;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.todayStr   = todayStr;
})();
