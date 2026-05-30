/* global Vue */
(function () {
const { reactive, watch } = Vue;

// в”Ђв”Ђ РЎРїСЂР°РІРѕС‡РЅРёРє СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const USERS = [
  { id:1, name:'Р СѓСЃР»Р°РЅ Р¦С‹РґС‹РїРѕРІРёС‡', short:'Р ', role:'owner', roleLabel:'Р“РµРЅ. РґРёСЂРµРєС‚РѕСЂ', dept:null, color:'#08205e' },
];

// в”Ђв”Ђ Р”РµРјРѕ-РґР°РЅРЅС‹Рµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const today = new Date();
const fmt   = (d) => d.toISOString().split('T')[0];
const days  = (n) => fmt(new Date(today.getTime() + n * 86400000));

const DEMO_TASKS = [
  { id:1, title:'РћР±РЅРѕРІРёС‚СЊ РїСЂР°Р№СЃ-Р»РёСЃС‚ РЅР° СЃР°Р№С‚Рµ',        desc:'Р”РѕР±Р°РІРёС‚СЊ РЅРѕРІС‹Рµ СѓСЃР»СѓРіРё Рё СЃРєРѕСЂСЂРµРєС‚РёСЂРѕРІР°С‚СЊ С†РµРЅС‹', assigneeId:1, createdBy:1, priority:'medium', status:'todo',     dept:'admin', deadline:days(2),  createdAt:days(-1) },
  { id:2, title:'РџРѕРґРіРѕС‚РѕРІРёС‚СЊ РѕС‚С‡С‘С‚ РїРѕ РІС‹СЂСѓС‡РєРµ Р·Р° РјР°Р№', desc:'РЎРІРѕРґРЅР°СЏ С‚Р°Р±Р»РёС†Р° РїРѕ РІСЃРµРј РІРёРґР°Рј СѓСЃР»СѓРі',          assigneeId:1, createdBy:1, priority:'high',   status:'progress', dept:'admin', deadline:days(1),  createdAt:days(-2) },
];

const DEMO_SHIFTS = [
  { id:1, userId:1, date:days(0), start:'09:00', end:'20:00', room:'РљР°Р±РёРЅРµС‚ РґРёСЂРµРєС‚РѕСЂР°', note:'' },
  { id:2, userId:1, date:days(1), start:'09:00', end:'20:00', room:'РљР°Р±РёРЅРµС‚ РґРёСЂРµРєС‚РѕСЂР°', note:'' },
];

const DEMO_TRANSACTIONS = [
  { id:1,  type:'income',  amount:3300, service:'РњР°СЃСЃР°Р¶ РєРѕРјРїР»РµРєСЃРЅС‹Р№',    patient:'РџРµС‚СЂРѕРІР° Рђ.',  cashierId:3, date:days(0),  time:'09:15', comment:'' },
  { id:2,  type:'income',  amount:1500, service:'РРіР»РѕСѓРєР°Р»С‹РІР°РЅРёРµ',         patient:'РРІР°РЅРѕРІ Рџ.',   cashierId:3, date:days(0),  time:'10:30', comment:'' },
  { id:3,  type:'income',  amount:1200, service:'РњР°СЃСЃР°Р¶ РЁР’Р—',             patient:'РЎРёРґРѕСЂРѕРІР° Рў.', cashierId:3, date:days(0),  time:'11:00', comment:'' },
  { id:4,  type:'expense', amount:500,  service:'Р Р°СЃС…РѕРґРЅРёРєРё (РёРіР»С‹)',       patient:'',            cashierId:2, date:days(0),  time:'13:00', comment:'Р—Р°РєСѓРїРєР° СЂР°СЃС…РѕРґРЅРёРєРѕРІ' },
  { id:5,  type:'income',  amount:2000, service:'РџСѓР»СЊСЃРѕРІР°СЏ РґРёР°РіРЅРѕСЃС‚РёРєР°',   patient:'Р‘СѓСЂР»РѕРІ Рљ.',   cashierId:3, date:days(0),  time:'14:20', comment:'' },
  { id:6,  type:'income',  amount:1700, service:'РРіР»РѕСѓРєР°Р»С‹РІР°РЅРёРµ + РњРѕРєСЃРѕ',  patient:'РҐРёС‚СЂРѕРІР° Р›.',  cashierId:3, date:days(0),  time:'15:40', comment:'' },
  { id:7,  type:'income',  amount:3300, service:'РњР°СЃСЃР°Р¶ РєРѕРјРїР»РµРєСЃРЅС‹Р№',    patient:'Р”РѕСЂРѕС€РµРІ Рњ.',  cashierId:3, date:days(-1), time:'09:30', comment:'' },
  { id:8,  type:'income',  amount:1000, service:'РњР°СЃСЃР°Р¶ Р“СѓР°С€Р°',           patient:'Р›РѕРјРѕРІР° РЎ.',   cashierId:3, date:days(-1), time:'11:15', comment:'' },
  { id:9,  type:'expense', amount:2800, service:'РҐРѕР·СЏР№СЃС‚РІРµРЅРЅС‹Рµ РЅСѓР¶РґС‹',    patient:'',            cashierId:2, date:days(-1), time:'16:00', comment:'РЎС‚РёСЂР°Р»СЊРЅС‹Р№ РїРѕСЂРѕС€РѕРє, РїРµСЂС‡Р°С‚РєРё' },
  { id:10, type:'income',  amount:1500, service:'Р¤РёС‚РѕСЃР±РѕСЂС‹',              patient:'РўСЂРѕС„РёРјРѕРІ Р’.', cashierId:3, date:days(-1), time:'10:00', comment:'' },
];

const DEMO_PHYTO = [
  { id:1,  name:'РђРіР°СЂ-35',    qty:8,  minQty:5, unit:'СѓРї', price:1400, category:'РќРµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°' },
  { id:2,  name:'РЎСѓРіРјСЌР»-10',  qty:3,  minQty:5, unit:'СѓРї', price:900,  category:'РљРѕРјРїР»РµРєСЃРЅС‹Р№' },
  { id:3,  name:'РўР°РЅС‡РµРЅ-25',  qty:12, minQty:5, unit:'СѓРї', price:1500, category:'Р”РµС‚РѕРєСЃ' },
  { id:4,  name:'Р–СѓРіР°РЅ-25',   qty:6,  minQty:3, unit:'СѓРї', price:850,  category:'Р›С‘РіРєРёРµ' },
  { id:5,  name:'Р’Р°РЅР»Р°Рі-37',  qty:2,  minQty:4, unit:'СѓРї', price:3650, category:'РЎРѕСЃСѓРґС‹' },
  { id:6,  name:'РђСЂСѓСЂ-10',    qty:15, minQty:5, unit:'СѓРї', price:900,  category:'РџРёС‰РµРІР°СЂРµРЅРёРµ' },
  { id:7,  name:'Р‘Р°Р°С‚Р°СЂ-7',   qty:9,  minQty:3, unit:'СѓРї', price:800,  category:'РњСѓР¶СЃРєРѕРµ Р·РґРѕСЂРѕРІСЊРµ' },
  { id:8,  name:'Р“РёРІР°РЅ-9',    qty:1,  minQty:4, unit:'СѓРї', price:850,  category:'РЎСѓСЃС‚Р°РІС‹' },
  { id:9,  name:'РќРµР№СЂРѕРІР°Р»РµРЅ', qty:11, minQty:5, unit:'СѓРї', price:1050, category:'РќРµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°' },
  { id:10, name:'РђРіР°СЂ-8',     qty:7,  minQty:3, unit:'СѓРї', price:900,  category:'РќРµСЂРІРЅР°СЏ СЃРёСЃС‚РµРјР°' },
  { id:11, name:'Р‘СЂСЌРіР°-13',   qty:4,  minQty:3, unit:'СѓРї', price:1300, category:'РРјРјСѓРЅРёС‚РµС‚' },
  { id:12, name:'Р§СѓРЅ-5',      qty:0,  minQty:3, unit:'СѓРї', price:1200, category:'Р”С‹С…Р°РЅРёРµ' },
];

const DEMO_MESSAGES = [];

const DEMO_NOTIFICATIONS = [];

const DEMO_DOCUMENTS = [];

const DEMO_PLANS = [];

// в”Ђв”Ђ РҐСЂР°РЅРёР»РёС‰Рµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// в”Ђв”Ђ РҐРµР»РїРµСЂС‹ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function getUser(id)     { return USERS.find(u => u.id === id) || null; }
function canManage(user) { return user && ['owner','admin'].includes(user.role); }
function nextId(arr)     { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

function timeAgo(isoStr) {
  const diff = (Date.now() - new Date(isoStr)) / 1000;
  if (diff < 60)    return 'С‚РѕР»СЊРєРѕ С‡С‚Рѕ';
  if (diff < 3600)  return Math.floor(diff / 60) + ' РјРёРЅ';
  if (diff < 86400) return Math.floor(diff / 3600) + ' С‡';
  return Math.floor(diff / 86400) + ' Рґ';
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

// Expose globally
window.APP_STATE = state;
window.APP_USERS = USERS;
window.getUser   = getUser;
window.canManage = canManage;
window.nextId    = nextId;
window.timeAgo   = timeAgo;
window.formatDate= formatDate;
window.formatTime= formatTime;
window.todayStr  = todayStr;
})();
