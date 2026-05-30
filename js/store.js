/* global Vue */
(function () {
const { reactive, watch } = Vue;

// ── Справочник сотрудников ─────────────────────────────────
const USERS = [
  { id:1, name:'Руслан Цыдыпович',    short:'Р', role:'owner', roleLabel:'Ген. директор',          dept:null,          color:'#08205e' },
  { id:2, name:'Ирина Барисовна',     short:'И', role:'admin', roleLabel:'Управляющий',            dept:null,          color:'#0d2d7a' },
  { id:3, name:'Екатерина Насаковна', short:'Е', role:'admin', roleLabel:'Исполнительный директор', dept:null,          color:'#1a3d8a' },
  { id:4, name:'Анна Сергеевна',      short:'А', role:'staff', roleLabel:'Отдел рекламы',           dept:'advertising', color:'#6a3a7a' },
  { id:5, name:'Татьяна Михайловна',  short:'Т', role:'staff', roleLabel:'Отдел продаж',            dept:'sales',       color:'#7a4a3a' },
];

// ── Демо-данные ─────────────────────────────────────────────
const today = new Date();
const fmt   = (d) => d.toISOString().split('T')[0];
const days  = (n) => fmt(new Date(today.getTime() + n * 86400000));

const DEMO_TASKS = [
  { id:1, title:'Обновить прайс-лист на сайте',           desc:'Добавить новые услуги и скорректировать цены',             assigneeId:4, createdBy:1, priority:'medium', status:'progress', dept:'advertising', deadline:days(2),  createdAt:days(-2) },
  { id:2, title:'Подготовить отчёт по выручке за май',    desc:'Сводная таблица по всем видам услуг',                      assigneeId:2, createdBy:1, priority:'high',   status:'todo',     dept:'admin',       deadline:days(1),  createdAt:days(-1) },
  { id:3, title:'Провести инструктаж по СанПиН',          desc:'Ознакомить сотрудников с правилами',                       assigneeId:3, createdBy:1, priority:'medium', status:'done',     dept:'admin',       deadline:days(-1), createdAt:days(-5) },
  { id:4, title:'Разработать пост для ВКонтакте',         desc:'Тема: польза пульсовой диагностики. Формат: карусель',     assigneeId:4, createdBy:2, priority:'low',    status:'todo',     dept:'advertising', deadline:days(4),  createdAt:days(-1) },
  { id:5, title:'Обзвон клиентов, не пришедших на приём', desc:'Список в таблице на Google Диске',                         assigneeId:5, createdBy:1, priority:'medium', status:'todo',     dept:'sales',       deadline:days(1),  createdAt:days(-2) },
  { id:6, title:'Подготовить акцию ко Дню здоровья',      desc:'Скидка 15% на комплекс 4 в 1',                            assigneeId:4, createdBy:1, priority:'medium', status:'progress', dept:'advertising', deadline:days(3),  createdAt:days(-3) },
  { id:7, title:'Согласовать бюджет на рекламу Q3',       desc:'Подготовить смету для утверждения у директора',            assigneeId:2, createdBy:1, priority:'high',   status:'todo',     dept:'admin',       deadline:days(3),  createdAt:days(-1) },
  { id:8, title:'Запустить таргетированную рекламу',      desc:'Настроить таргет ВКонтакте на летний сезон',               assigneeId:4, createdBy:2, priority:'medium', status:'todo',     dept:'advertising', deadline:days(5),  createdAt:days(-1) },
];

const DEMO_SHIFTS = [
  { id:1,  userId:1, date:days(0), start:'09:00', end:'20:00', room:'Кабинет директора', note:'' },
  { id:2,  userId:2, date:days(0), start:'09:00', end:'18:00', room:'Офис',              note:'' },
  { id:3,  userId:3, date:days(0), start:'09:00', end:'18:00', room:'Офис',              note:'' },
  { id:4,  userId:4, date:days(0), start:'10:00', end:'19:00', room:'Офис',              note:'' },
  { id:5,  userId:5, date:days(0), start:'09:00', end:'20:00', room:'Офис',              note:'' },
  { id:6,  userId:1, date:days(1), start:'09:00', end:'20:00', room:'Кабинет директора', note:'' },
  { id:7,  userId:2, date:days(1), start:'09:00', end:'18:00', room:'Офис',              note:'' },
  { id:8,  userId:4, date:days(2), start:'10:00', end:'19:00', room:'Офис',              note:'' },
  { id:9,  userId:5, date:days(2), start:'09:00', end:'20:00', room:'Офис',              note:'' },
  { id:10, userId:3, date:days(2), start:'09:00', end:'18:00', room:'Офис',              note:'' },
];

const DEMO_TRANSACTIONS = [
  { id:1,  type:'income',  amount:3300, service:'Массаж комплексный',    patient:'Петрова А.',  cashierId:3, date:days(0),  time:'09:15', comment:'' },
  { id:2,  type:'income',  amount:1500, service:'Иглоукалывание',         patient:'Иванов П.',   cashierId:3, date:days(0),  time:'10:30', comment:'' },
  { id:3,  type:'income',  amount:1200, service:'Массаж ШВЗ',             patient:'Сидорова Т.', cashierId:3, date:days(0),  time:'11:00', comment:'' },
  { id:4,  type:'expense', amount:500,  service:'Расходники (иглы)',       patient:'',            cashierId:2, date:days(0),  time:'13:00', comment:'Закупка расходников' },
  { id:5,  type:'income',  amount:2000, service:'Пульсовая диагностика',   patient:'Бурлов К.',   cashierId:3, date:days(0),  time:'14:20', comment:'' },
  { id:6,  type:'income',  amount:1700, service:'Иглоукалывание + Моксо',  patient:'Хитрова Л.',  cashierId:3, date:days(0),  time:'15:40', comment:'' },
  { id:7,  type:'income',  amount:3300, service:'Массаж комплексный',    patient:'Дорошев М.',  cashierId:3, date:days(-1), time:'09:30', comment:'' },
  { id:8,  type:'income',  amount:1000, service:'Массаж Гуаша',           patient:'Ломова С.',   cashierId:3, date:days(-1), time:'11:15', comment:'' },
  { id:9,  type:'expense', amount:2800, service:'Хозяйственные нужды',    patient:'',            cashierId:2, date:days(-1), time:'16:00', comment:'Стиральный порошок, перчатки' },
  { id:10, type:'income',  amount:1500, service:'Фитосборы',              patient:'Трофимов В.', cashierId:3, date:days(-1), time:'10:00', comment:'' },
];

const DEMO_PHYTO = [
  { id:1,  name:'Агар-35',    qty:8,  minQty:5, unit:'уп', price:1400, category:'Нервная система' },
  { id:2,  name:'Сугмэл-10',  qty:3,  minQty:5, unit:'уп', price:900,  category:'Комплексный' },
  { id:3,  name:'Танчен-25',  qty:12, minQty:5, unit:'уп', price:1500, category:'Детокс' },
  { id:4,  name:'Жуган-25',   qty:6,  minQty:3, unit:'уп', price:850,  category:'Лёгкие' },
  { id:5,  name:'Ванлаг-37',  qty:2,  minQty:4, unit:'уп', price:3650, category:'Сосуды' },
  { id:6,  name:'Арур-10',    qty:15, minQty:5, unit:'уп', price:900,  category:'Пищеварение' },
  { id:7,  name:'Баатар-7',   qty:9,  minQty:3, unit:'уп', price:800,  category:'Мужское здоровье' },
  { id:8,  name:'Гиван-9',    qty:1,  minQty:4, unit:'уп', price:850,  category:'Суставы' },
  { id:9,  name:'Нейровален', qty:11, minQty:5, unit:'уп', price:1050, category:'Нервная система' },
  { id:10, name:'Агар-8',     qty:7,  minQty:3, unit:'уп', price:900,  category:'Нервная система' },
  { id:11, name:'Брэга-13',   qty:4,  minQty:3, unit:'уп', price:1300, category:'Иммунитет' },
  { id:12, name:'Чун-5',      qty:0,  minQty:3, unit:'уп', price:1200, category:'Дыхание' },
];

const DEMO_MESSAGES = [
  { id:1, roomId:'all', senderId:1, text:'Доброе утро, коллеги! Сегодня планёрка в 18:00. Не опаздываем 🙏', time:days(0)+'T08:00:00', read:false },
  { id:2, roomId:'all', senderId:3, text:'Всем доброе утро! Клиенты довольны, всё идёт по плану',             time:days(0)+'T09:05:00', read:false },
  { id:3, roomId:'all', senderId:5, text:'Обзвон начат, 3 записи на завтра уже есть',                        time:days(0)+'T09:10:00', read:false },
  { id:4, roomId:'all', senderId:4, text:'Анонс поста по диагностике готов, проверьте пожалуйста @Руслан',   time:days(0)+'T10:30:00', read:false },
];

const DEMO_NOTIFICATIONS = [
  { id:1, type:'meeting',  title:'Планёрка сегодня в 18:00',     body:'Присутствие обязательно для всех сотрудников',        time:days(0)+'T07:00:00',  isRead:false, authorId:1 },
  { id:2, type:'task',     title:'Вам назначена задача',          body:'Согласовать бюджет на рекламу Q3 — срок через 3 дня', time:days(0)+'T08:15:00',  isRead:false, authorId:2 },
  { id:3, type:'system',   title:'Низкий остаток на складе',      body:'Сугмэл-10: осталось 3 уп. (минимум 5)',               time:days(0)+'T09:00:00',  isRead:false, authorId:null },
  { id:4, type:'announce', title:'Обновление прайс-листа',        body:'С 1 июня вступают в силу новые цены.',                time:days(-1)+'T17:00:00', isRead:true,  authorId:1 },
  { id:5, type:'meeting',  title:'Обучение новому методу',        body:'Пятница, 14:00 — мастер-класс',                       time:days(-2)+'T12:00:00', isRead:true,  authorId:1 },
];

const DEMO_DOCUMENTS = [
  { id:1,  folder:'instructions', name:'Должностная инструкция — Отдел рекламы',           type:'pdf',  size:'98 КБ',  date:'15.04.2025', authorId:1 },
  { id:2,  folder:'instructions', name:'Должностная инструкция — Отдел продаж',            type:'pdf',  size:'89 КБ',  date:'15.04.2025', authorId:1 },
  { id:3,  folder:'instructions', name:'Должностная инструкция — Исполнительный директор', type:'pdf',  size:'124 КБ', date:'15.04.2025', authorId:1 },
  { id:4,  folder:'sanpin',       name:'СанПиН 2.1.3678-20 (медицинские организации)',     type:'pdf',  size:'2.3 МБ', date:'01.01.2021', authorId:1 },
  { id:5,  folder:'sanpin',       name:'Требования к стерилизации инструментов',           type:'pdf',  size:'445 КБ', date:'10.03.2025', authorId:2 },
  { id:6,  folder:'sanpin',       name:'Журнал дезинфекции — шаблон',                      type:'docx', size:'32 КБ',  date:'01.02.2025', authorId:2 },
  { id:7,  folder:'orders',       name:'Приказ №1 — Об утверждении режима работы',         type:'pdf',  size:'67 КБ',  date:'01.01.2025', authorId:1 },
  { id:8,  folder:'orders',       name:'Приказ №3 — Прайс-лист (действующий)',             type:'pdf',  size:'89 КБ',  date:'01.04.2025', authorId:1 },
  { id:9,  folder:'other',        name:'Скрипты продаж для администраторов',               type:'docx', size:'78 КБ',  date:'20.03.2025', authorId:5 },
  { id:10, folder:'other',        name:'Контакты поставщиков фитосборов',                  type:'xlsx', size:'24 КБ',  date:'05.02.2025', authorId:1 },
];

const DEMO_PLANS = [
  { id:1, dept:'advertising', title:'Контент-план май 2025',          content:'12 постов ВКонтакте, 3 Reels, 2 коллаборации',                        status:'active', authorId:4, date:'01.05.2025' },
  { id:2, dept:'advertising', title:'Рекламная кампания: лето 2025',  content:'Бюджет 30 000 руб. Таргет ВК, 2ГИС, баннер на Боевой',                status:'draft',  authorId:4, date:'25.04.2025' },
  { id:3, dept:'sales',       title:'План продаж май 2025',           content:'Цель: 320 000 руб. выручки. Конверсия из звонков: 35%',                status:'active', authorId:5, date:'01.05.2025' },
  { id:4, dept:'sales',       title:'Скрипты для повторных продаж',   content:'Алгоритм обзвона пациентов через 14 дней после визита',                status:'active', authorId:5, date:'10.04.2025' },
  { id:5, dept:'marketing',   title:'Стратегия продвижения 2025',     content:'Фокус: онлайн-записи +40%, программа лояльности, отзывы',             status:'active', authorId:2, date:'01.01.2025' },
  { id:6, dept:'marketing',   title:'Программа лояльности «Здоровье»',content:'Карта клиента, накопительные баллы, скидка 10% от 5 визитов',         status:'draft',  authorId:2, date:'15.04.2025' },
  { id:7, dept:'strategy',    title:'Стратегия развития 2025–2026',   content:'Открытие 2-го кабинета, найм врача Эмчи, выручка 5 млн/год',          status:'active', authorId:1, date:'01.01.2025' },
  { id:8, dept:'strategy',    title:'OKR Q2 2025',                    content:'О: Вырасти в выручке на 25%. KR1: 300+ клиентов/мес. KR2: NPS > 4.5', status:'active', authorId:1, date:'01.04.2025' },
];

// ── Хранилище ─────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveLS(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

const state = reactive({
  currentUser:   loadLS('be2_user',   null),
  tasks:         loadLS('be2_tasks',  DEMO_TASKS),
  shifts:        loadLS('be2_shifts', DEMO_SHIFTS),
  transactions:  loadLS('be2_tx',     DEMO_TRANSACTIONS),
  phyto:         loadLS('be2_phyto',  DEMO_PHYTO),
  messages:      loadLS('be2_msgs',   DEMO_MESSAGES),
  notifications: loadLS('be2_notifs', DEMO_NOTIFICATIONS),
  documents:     loadLS('be2_docs',   DEMO_DOCUMENTS),
  plans:         loadLS('be2_plans',  DEMO_PLANS),
});

watch(() => state.currentUser,   v => saveLS('be2_user',   v));
watch(() => state.tasks,         v => saveLS('be2_tasks',  v), { deep:true });
watch(() => state.shifts,        v => saveLS('be2_shifts', v), { deep:true });
watch(() => state.transactions,  v => saveLS('be2_tx',     v), { deep:true });
watch(() => state.phyto,         v => saveLS('be2_phyto',  v), { deep:true });
watch(() => state.messages,      v => saveLS('be2_msgs',   v), { deep:true });
watch(() => state.notifications, v => saveLS('be2_notifs', v), { deep:true });
watch(() => state.documents,     v => saveLS('be2_docs',   v), { deep:true });
watch(() => state.plans,         v => saveLS('be2_plans',  v), { deep:true });

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
