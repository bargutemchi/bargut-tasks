/* global Vue, APP_STATE, canManage, nextId */
const { defineComponent, ref, computed } = Vue;

window.PhytoView = defineComponent({
  name: 'Phyto',
  setup() {
    const state   = window.APP_STATE;
    const user    = computed(() => state.currentUser);
    const search  = ref('');
    const tab     = ref('all');
    const showAdd  = ref(false);
    const showEdit = ref(null);
    const newItem  = ref({ name:'', qty:0, minQty:3, unit:'уп', price:0, category:'' });

    const filtered = computed(() => {
      let items = state.phyto;
      if (search.value) items = items.filter(p => p.name.toLowerCase().includes(search.value.toLowerCase()));
      if (tab.value === 'low') items = items.filter(p => p.qty <= p.minQty);
      if (tab.value === 'out') items = items.filter(p => p.qty === 0);
      return items.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    });

    const lowCount = computed(() => state.phyto.filter(p => p.qty <= p.minQty).length);

    function stockLevel(item) {
      if (item.qty === 0) return { pct:0, cls:'stock-critical' };
      const ratio = item.qty / (item.minQty * 3);
      if (ratio < 0.4) return { pct: Math.round(ratio * 100), cls:'stock-low' };
      return { pct: Math.min(100, Math.round(ratio * 100)), cls:'stock-ok' };
    }

    function addItem() {
      if (!newItem.value.name.trim()) return;
      state.phyto.push({
        id: window.nextId(state.phyto),
        ...newItem.value,
        qty:    Number(newItem.value.qty),
        minQty: Number(newItem.value.minQty),
        price:  Number(newItem.value.price),
      });
      newItem.value = { name:'', qty:0, minQty:3, unit:'уп', price:0, category:'' };
      showAdd.value = false;
    }

    function saveEdit() {
      Object.assign(showEdit.value, {
        qty:    Number(showEdit.value.qty),
        minQty: Number(showEdit.value.minQty),
        price:  Number(showEdit.value.price),
      });
      showEdit.value = null;
    }

    function removeItem(id) {
      const idx = state.phyto.findIndex(p => p.id === id);
      if (idx !== -1) state.phyto.splice(idx, 1);
      showEdit.value = null;
    }

    return {
      user, search, tab, filtered, lowCount, showAdd, showEdit, newItem, state,
      stockLevel, addItem, saveEdit, removeItem, canManage: window.canManage,
    };
  },

  template: `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1 class="page-title" style="margin:0;">Склад Фито</h1>
        <button v-if="canManage(user)" class="btn btn-primary btn-sm" @click="showAdd=true">
          + Добавить
        </button>
      </div>

      <div v-if="lowCount > 0"
           style="background:#FFF5F5; border-left:4px solid #e53e3e; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">⚠️</span>
        <div>
          <div style="font-size:14px; font-weight:700; color:#c53030;">Заканчивается {{ lowCount }} позиций</div>
          <div style="font-size:12px; color:#e53e3e;">Нажмите «Нехватка» для просмотра</div>
        </div>
      </div>

      <input class="form-control" v-model="search" placeholder="🔍  Поиск по названию..."
             style="margin-bottom:12px;">

      <div class="tabs">
        <button class="tab" :class="{active:tab==='all'}" @click="tab='all'">Все ({{ state.phyto.length }})</button>
        <button class="tab" :class="{active:tab==='low'}" @click="tab='low'">⚠️ Нехватка ({{ lowCount }})</button>
        <button class="tab" :class="{active:tab==='out'}" @click="tab='out'">Нет в наличии</button>
      </div>

      <div class="card" style="padding:8px 16px;">
        <div v-if="filtered.length===0" class="empty-state" style="padding:24px;">
          <span class="empty-icon">📦</span>
          <span class="empty-text">Ничего не найдено</span>
        </div>
        <div v-for="item in filtered" :key="item.id" class="phyto-item"
             @click="canManage(user) ? showEdit = {...item} : null"
             :style="{ cursor: canManage(user) ? 'pointer' : 'default' }">
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px; font-weight:600; color:#1a2a4a; margin-bottom:2px;">{{ item.name }}</div>
            <div style="font-size:12px; color:#4a5a7a; margin-bottom:4px;">
              {{ item.category }} · {{ item.price.toLocaleString('ru-RU') }} ₽/{{ item.unit }}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="stock-bar">
                <div class="stock-fill" :class="stockLevel(item).cls"
                     :style="{ width: stockLevel(item).pct + '%' }"></div>
              </div>
              <span style="font-size:12px; font-weight:700;"
                    :style="{ color: item.qty===0 ? '#e53e3e' : item.qty<=item.minQty ? '#dd6b20' : '#38a169' }">
                {{ item.qty }} {{ item.unit }}
              </span>
              <span style="font-size:11px; color:#8a9aba;">(мин. {{ item.minQty }})</span>
            </div>
          </div>
          <span v-if="canManage(user)" style="color:#c0c8d8; font-size:20px;">✏️</span>
        </div>
      </div>

      <!-- Edit Modal -->
      <div v-if="showEdit" class="modal-overlay" @click.self="showEdit=null">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">{{ showEdit.name }}</h2>
            <button class="modal-close" @click="showEdit=null">✕</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">В наличии</label>
              <input type="number" class="form-control" v-model="showEdit.qty" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Минимум</label>
              <input type="number" class="form-control" v-model="showEdit.minQty" min="0">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Цена (₽)</label>
            <input type="number" class="form-control" v-model="showEdit.price" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Категория</label>
            <input class="form-control" v-model="showEdit.category">
          </div>
          <div style="display:flex; gap:10px; margin-top:4px;">
            <button class="btn btn-primary" style="flex:1;" @click="saveEdit">Сохранить</button>
            <button class="btn btn-danger btn-sm" @click="removeItem(showEdit.id)">🗑</button>
          </div>
        </div>
      </div>

      <!-- Add Modal -->
      <div v-if="showAdd" class="modal-overlay" @click.self="showAdd=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Добавить позицию</h2>
            <button class="modal-close" @click="showAdd=false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Название *</label>
            <input class="form-control" v-model="newItem.name" placeholder="Агар-35">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Количество</label>
              <input type="number" class="form-control" v-model="newItem.qty" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Минимум</label>
              <input type="number" class="form-control" v-model="newItem.minQty" min="0">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Цена (₽)</label>
              <input type="number" class="form-control" v-model="newItem.price" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">Единица</label>
              <input class="form-control" v-model="newItem.unit" placeholder="уп">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Категория</label>
            <input class="form-control" v-model="newItem.category" placeholder="Нервная система">
          </div>
          <button class="btn btn-primary btn-block" @click="addItem">Добавить</button>
        </div>
      </div>
    </div>
  `,
});
