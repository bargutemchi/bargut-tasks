/* global Vue, APP_STATE, APP_USERS, getUser, canManage, nextId, todayStr */
(function () {
const { defineComponent, ref, computed } = Vue;

window.ScheduleView = defineComponent({
  name: 'Schedule',
  setup() {
    const state  = window.APP_STATE;
    const USERS  = window.APP_USERS;
    const user   = computed(() => state.currentUser);
    const showAdd = ref(false);
    const newShift = ref({ userId:null, date: window.todayStr(), start:'09:00', end:'18:00', room:'', note:'' });
    const ROOMS = ['Кабинет 1','Кабинет 2','Массажный зал','Ресепшн','Зал ожидания'];

    const weekDays = computed(() => {
      const result = [];
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() + i * 86400000);
        result.push({
          date:    d.toISOString().split('T')[0],
          label:   d.toLocaleDateString('ru-RU', { weekday:'short', day:'numeric', month:'short' }),
          isToday: i === 0,
        });
      }
      return result;
    });

    function shiftsForDay(date) {
      let shifts = state.shifts.filter(s => s.date === date);
      if (!window.canManage(user.value)) {
        shifts = shifts.filter(s => s.userId === user.value.id);
      }
      return shifts;
    }

    function addShift() {
      if (!newShift.value.userId || !newShift.value.date) return;
      state.shifts.push({
        id: window.nextId(state.shifts),
        ...newShift.value,
        userId: Number(newShift.value.userId),
      });
      state.notifications.unshift({
        id: window.nextId(state.notifications),
        type: 'announce', title: 'Новое дежурство',
        body: `${window.getUser(Number(newShift.value.userId))?.name}: ${newShift.value.date} ${newShift.value.start}–${newShift.value.end}`,
        time: new Date().toISOString(), isRead: false, authorId: user.value.id,
      });
      showAdd.value = false;
      newShift.value = { userId:null, date: window.todayStr(), start:'09:00', end:'18:00', room:'', note:'' };
    }

    function removeShift(id) {
      const idx = state.shifts.findIndex(s => s.id === id);
      if (idx !== -1) state.shifts.splice(idx, 1);
    }

    return {
      user, showAdd, newShift, USERS, ROOMS, weekDays,
      shiftsForDay, addShift, removeShift,
      getUser: window.getUser, canManage: window.canManage,
    };
  },

  template: `
    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h1 class="page-title" style="margin:0;">Расписание дежурств</h1>
        <button v-if="canManage(user)" class="btn btn-primary btn-sm" @click="showAdd=true">
          + Добавить
        </button>
      </div>

      <div v-for="day in weekDays" :key="day.date">
        <div class="schedule-day">
          <div class="schedule-day-header"
               :style="day.isToday ? 'background:linear-gradient(90deg,#08205e,#0d2d7a)' : ''">
            {{ day.isToday ? '📍 Сегодня — ' : '' }}{{ day.label }}
          </div>

          <div v-if="shiftsForDay(day.date).length === 0"
               style="background:white; padding:10px 14px; color:#8a9aba; font-size:13px;">
            {{ canManage(user) ? 'Нет дежурств' : 'У вас нет дежурств' }}
          </div>

          <div v-for="shift in shiftsForDay(day.date)" :key="shift.id" class="schedule-shift">
            <div class="avatar avatar-sm" :style="{ background: getUser(shift.userId)?.color }">
              {{ getUser(shift.userId)?.short }}
            </div>
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:600; color:#1a2a4a;">
                {{ getUser(shift.userId)?.name }}
              </div>
              <div style="font-size:12px; color:#4a5a7a;">
                {{ shift.start }} – {{ shift.end }}
                <span v-if="shift.room" style="margin-left:6px;">· {{ shift.room }}</span>
              </div>
              <div v-if="shift.note" style="font-size:11px; color:#8a9aba; margin-top:2px;">{{ shift.note }}</div>
            </div>
            <button v-if="canManage(user)"
                    style="background:none; border:none; color:#c0c8d8; font-size:18px; cursor:pointer; padding:4px 8px;"
                    @click="removeShift(shift.id)">✕</button>
          </div>
        </div>
      </div>

      <!-- Add Shift Modal -->
      <div v-if="showAdd" class="modal-overlay" @click.self="showAdd=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Добавить дежурство</h2>
            <button class="modal-close" @click="showAdd=false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Сотрудник</label>
            <select class="form-control" v-model="newShift.userId">
              <option :value="null">Выберите...</option>
              <option v-for="u in USERS" :key="u.id" :value="u.id">{{ u.name }} — {{ u.roleLabel }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Дата</label>
            <input type="date" class="form-control" v-model="newShift.date">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Начало</label>
              <input type="time" class="form-control" v-model="newShift.start">
            </div>
            <div class="form-group">
              <label class="form-label">Конец</label>
              <input type="time" class="form-control" v-model="newShift.end">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Место/кабинет</label>
            <select class="form-control" v-model="newShift.room">
              <option value="">Не указано</option>
              <option v-for="r in ROOMS" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Примечание</label>
            <input class="form-control" v-model="newShift.note" placeholder="Необязательно">
          </div>
          <button class="btn btn-primary btn-block" @click="addShift">Сохранить</button>
        </div>
      </div>
    </div>
  `,
});
})();
