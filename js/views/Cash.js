/* global Vue, APP_STATE, getUser, canManage, nextId, todayStr */
const { defineComponent, ref, computed } = Vue;

const SERVICES = [
  'Массаж комплексный','Массаж лица','Массаж спины','Массаж ШВЗ',
  'Правка головы','Массаж Гуаша','Иглоукалывание','Иглоукалывание + Моксо',
  'Моксоперация','Пульсовая диагностика','Фитосборы','Лимфодренажный массаж',
  'Аурикулотерапия','Постановка банок','Расходники','Хозяйственные нужды','Другое',
];

window.CashView = defineComponent({
  name: 'Cash',
  setup() {
    const state      = window.APP_STATE;
    const user       = computed(() => state.currentUser);
    const dateFilter = ref(window.todayStr());
    const showAdd    = ref(false);
    const newTx      = ref({ type:'income', amount:'', service:'', patient:'', comment:'' });

    const filtered = computed(() =>
      state.transactions
        .filter(t => t.date === dateFilter.value)
        .sort((a, b) => b.time.localeCompare(a.time))
    );

    const totals = computed(() => ({
      income:  filtered.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: filtered.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }));

    const net = computed(() => totals.value.income - totals.value.expense);

    function addTx() {
      const amount = parseInt(newTx.value.amount);
      if (!amount || amount <= 0) return;
      state.transactions.unshift({
        id:       window.nextId(state.transactions),
        type:     newTx.value.type,
        amount,
        service:  newTx.value.service || '—',
        patient:  newTx.value.patient || '',
        cashierId: user.value.id,
        date: dateFilter.value,
        time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }),
        comment: newTx.value.comment,
      });
      newTx.value = { type:'income', amount:'', service:'', patient:'', comment:'' };
      showAdd.value = false;
    }

    function removeTx(id) {
      const idx = state.transactions.findIndex(t => t.id === id);
      if (idx !== -1) state.transactions.splice(idx, 1);
    }

    return {
      user, dateFilter, filtered, totals, net, showAdd, newTx, SERVICES,
      addTx, removeTx, getUser: window.getUser, canManage: window.canManage,
    };
  },

  template: `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1 class="page-title" style="margin:0;">Касса</h1>
        <button class="btn btn-primary btn-sm" @click="showAdd=true">+ Приход/Расход</button>
      </div>

      <div style="margin-bottom:16px;">
        <input type="date" class="form-control" v-model="dateFilter" style="max-width:200px;">
      </div>

      <div class="cash-summary">
        <div style="font-size:11px; color:rgba(255,255,255,.6); letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">
          Итоги за {{ dateFilter }}
        </div>
        <div class="cash-total">{{ net.toLocaleString('ru-RU') }} ₽</div>
        <div style="font-size:11px; color:rgba(255,255,255,.5); margin-bottom:16px;">Чистая прибыль</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="background:rgba(56,161,105,.15); border-radius:10px; padding:12px;">
            <div style="font-size:18px; font-weight:700; color:#68d391;">+{{ totals.income.toLocaleString('ru-RU') }} ₽</div>
            <div style="font-size:11px; color:rgba(255,255,255,.5); margin-top:2px;">Приход</div>
          </div>
          <div style="background:rgba(229,62,62,.15); border-radius:10px; padding:12px;">
            <div style="font-size:18px; font-weight:700; color:#fc8181;">−{{ totals.expense.toLocaleString('ru-RU') }} ₽</div>
            <div style="font-size:11px; color:rgba(255,255,255,.5); margin-top:2px;">Расход</div>
          </div>
        </div>
      </div>

      <div class="card" style="padding:8px 16px;">
        <div v-if="filtered.length===0" class="empty-state" style="padding:24px;">
          <span class="empty-icon">💰</span>
          <span class="empty-text">Нет операций за эту дату</span>
        </div>
        <div v-for="tx in filtered" :key="tx.id" class="tx-item">
          <div class="tx-icon" :class="tx.type==='income' ? 'tx-income' : 'tx-expense'">
            {{ tx.type==='income' ? '↑' : '↓' }}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; color:#1a2a4a;">{{ tx.service }}</div>
            <div style="font-size:12px; color:#4a5a7a;">
              <span v-if="tx.patient">{{ tx.patient }} · </span>
              {{ tx.time }} · {{ getUser(tx.cashierId)?.name }}
            </div>
            <div v-if="tx.comment" style="font-size:11px; color:#8a9aba;">{{ tx.comment }}</div>
          </div>
          <div style="text-align:right;">
            <div class="tx-amount" :class="tx.type">
              {{ tx.type==='income' ? '+' : '−' }}{{ tx.amount.toLocaleString('ru-RU') }} ₽
            </div>
            <button v-if="canManage(user)"
                    style="background:none;border:none;color:#c0c8d8;font-size:13px;cursor:pointer;padding:2px 6px;"
                    @click="removeTx(tx.id)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="showAdd" class="modal-overlay" @click.self="showAdd=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Новая операция</h2>
            <button class="modal-close" @click="showAdd=false">✕</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
            <button class="btn" :class="newTx.type==='income' ? 'btn-gold' : 'btn-outline'"
                    @click="newTx.type='income'">↑ Приход</button>
            <button class="btn" :class="newTx.type==='expense' ? 'btn-danger' : 'btn-outline'"
                    @click="newTx.type='expense'">↓ Расход</button>
          </div>
          <div class="form-group">
            <label class="form-label">Сумма, ₽ *</label>
            <input type="number" class="form-control" v-model="newTx.amount" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Услуга / статья</label>
            <select class="form-control" v-model="newTx.service">
              <option value="">Выберите...</option>
              <option v-for="s in SERVICES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div v-if="newTx.type==='income'" class="form-group">
            <label class="form-label">Пациент (ФИО)</label>
            <input class="form-control" v-model="newTx.patient" placeholder="Фамилия И.О.">
          </div>
          <div class="form-group">
            <label class="form-label">Комментарий</label>
            <input class="form-control" v-model="newTx.comment" placeholder="Необязательно">
          </div>
          <button class="btn btn-primary btn-block" @click="addTx">Сохранить</button>
        </div>
      </div>
    </div>
  `,
});
