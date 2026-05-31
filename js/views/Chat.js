/* global Vue, APP_STATE, APP_USERS, formatTime */
(function () {
const { defineComponent, ref, computed, nextTick, onMounted, onUnmounted } = Vue;

function compressImage(file, maxPx, quality) {
  maxPx = maxPx || 1024;
  quality = quality || 0.82;
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else       { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.readAsDataURL(blob);
  });
}

function formatDateLabel(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yest)  return 'Вчера';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

window.ChatView = defineComponent({
  name: 'Chat',

  setup() {
    const db    = window.supabaseClient;
    const state = window.APP_STATE;
    const USERS = window.APP_USERS;
    const user  = computed(() => state.currentUser);

    const roomId       = ref('all');
    const newMsg       = ref('');
    const msgEnd       = ref(null);
    const messages     = ref([]);
    const mediaPreview = ref(null);
    const uploading    = ref(false);
    const lightbox     = ref(null);
    const photoInput   = ref(null);
    const loadError    = ref(null);
    const onlineSet    = Vue.reactive(new Set());

    // Непрочитанные: метки времени последнего посещения комнаты
    const readAt = ref(JSON.parse(localStorage.getItem('be3_read_at') || '{}'));

    // Слушаем изменения онлайн-статуса
    if (window.Presence) {
      window.Presence.onChange(updated => {
        onlineSet.clear();
        updated.forEach(id => onlineSet.add(id));
      });
      window.Presence.onlineUsers.forEach(id => onlineSet.add(id));
    }

    function isOnline(userId) { return onlineSet.has(Number(userId)); }

    // ── Комнаты ─────────────────────────────────────────────
    const rooms = computed(() => {
      const personal = USERS
        .filter(u => u.id !== user.value.id)
        .map(u => {
          const a = Math.min(user.value.id, u.id);
          const b = Math.max(user.value.id, u.id);
          return { id: 'dm_' + a + '_' + b, label: u.name, sub: u.roleLabel, user: u };
        });
      return [
        { id: 'all', label: 'Все сотрудники', sub: 'Общий чат', user: null },
        ...personal,
      ];
    });

    const currentRoom = computed(() => rooms.value.find(r => r.id === roomId.value));

    const currentMessages = computed(() =>
      messages.value.filter(m => m.room_id === roomId.value)
    );

    // Сообщения с разделителями дат
    const messagesWithDates = computed(() => {
      const result = [];
      let lastDate = null;
      for (const msg of currentMessages.value) {
        const date = (msg.created_at || '').slice(0, 10);
        if (date && date !== lastDate) {
          result.push({ type: 'date', date, label: formatDateLabel(date) });
          lastDate = date;
        }
        result.push(msg);
      }
      return result;
    });

    // Последнее сообщение в комнате
    function lastMessage(rid) {
      const roomMsgs = messages.value.filter(m => m.room_id === rid);
      return roomMsgs[roomMsgs.length - 1] || null;
    }

    // Непрочитанные
    function markRead(rid) {
      readAt.value[rid] = new Date().toISOString();
      localStorage.setItem('be3_read_at', JSON.stringify(readAt.value));
    }

    function unreadCount(rid) {
      const since = readAt.value[rid];
      return messages.value.filter(function(m) {
        return m.room_id === rid &&
          m.sender_id !== user.value.id &&
          (!since || m.created_at > since);
      }).length;
    }

    let channel = null;

    // ── Загрузка истории ─────────────────────────────────────
    async function loadMessages() {
      const { data, error } = await db
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) {
        loadError.value = error.message;
      } else {
        messages.value = data || [];
        nextTick(scrollToBottom);
      }
    }

    // ── Realtime-подписка ────────────────────────────────────
    function subscribeRealtime() {
      channel = db
        .channel('public:messages')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => {
            const exists = messages.value.find(m => m.id === payload.new.id);
            if (!exists) messages.value.push(payload.new);
            if (payload.new.room_id === roomId.value) nextTick(scrollToBottom);
          }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'messages' },
          payload => {
            if (payload.old && payload.old.id) {
              messages.value = messages.value.filter(m => m.id !== payload.old.id);
            }
          }
        )
        .subscribe();
    }

    onMounted(async () => {
      await loadMessages();
      markRead(roomId.value);
      subscribeRealtime();
    });

    onUnmounted(() => {
      if (channel) db.removeChannel(channel);
    });

    // ── Навигация ────────────────────────────────────────────
    function selectRoom(rid) {
      roomId.value = rid;
      markRead(rid);
      nextTick(scrollToBottom);
    }

    function scrollToBottom() {
      if (msgEnd.value) msgEnd.value.scrollIntoView({ behavior: 'smooth' });
    }

    // ── Удаление сообщения ───────────────────────────────────
    async function deleteMsg(id) {
      messages.value = messages.value.filter(m => m.id !== id);
      const { error } = await db.from('messages').delete().eq('id', id);
      if (error) { alert('Ошибка удаления: ' + error.message); loadMessages(); }
    }

    // ── Фото ─────────────────────────────────────────────────
    function triggerPhoto() { if (photoInput.value) photoInput.value.click(); }

    async function onPhotoSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      const blob = await compressImage(file);
      const url  = URL.createObjectURL(blob);
      if (mediaPreview.value) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = { url, blob, type: 'image' };
    }

    function cancelMedia() {
      if (mediaPreview.value) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = null;
    }

    // ── Отправка ─────────────────────────────────────────────
    async function send() {
      const text = newMsg.value.trim();
      if (!text && !mediaPreview.value) return;
      uploading.value = true;

      let media_data = null;
      let media_type = null;

      if (mediaPreview.value) {
        media_data = await blobToBase64(mediaPreview.value.blob);
        media_type = 'image';
        URL.revokeObjectURL(mediaPreview.value.url);
        mediaPreview.value = null;
      }

      const { error } = await db.from('messages').insert({
        room_id:      roomId.value,
        sender_id:    user.value.id,
        sender_name:  user.value.name,
        sender_short: user.value.short,
        sender_color: user.value.color,
        text:         text || null,
        media_data,
        media_type,
      });

      if (error) alert('Ошибка отправки: ' + error.message);

      if (!error) {
        const notifText = text || '📷 Фото';
        fetch('https://ntfy.sh/bargut-emchi-2026', {
          method: 'POST',
          headers: {
            'Title': user.value.name,
            'Priority': 'default',
            'Tags': 'hospital',
          },
          body: notifText,
        }).catch(() => {});
      }

      newMsg.value  = '';
      uploading.value = false;
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    function openLightbox(src)  { lightbox.value = src; }
    function closeLightbox()    { lightbox.value = null; }

    return {
      user, roomId, rooms, currentRoom, currentMessages, messagesWithDates,
      newMsg, msgEnd, photoInput,
      mediaPreview, uploading, lightbox, loadError,
      selectRoom, send, handleKey,
      triggerPhoto, onPhotoSelected, cancelMedia,
      openLightbox, closeLightbox, deleteMsg,
      formatTime: window.formatTime,
      isOnline, unreadCount, lastMessage,
    };
  },

  template: `
    <div style="display:flex; flex-direction:column; height:calc(100vh - 116px); margin:-16px; overflow:hidden;">

      <!-- Ошибка -->
      <div v-if="loadError"
           style="padding:14px 16px; background:#fff5f5; color:#c53030; font-size:13px; text-align:center; flex-shrink:0;">
        ⚠️ Таблица messages не найдена.<br>
        <small>Создайте её в Supabase SQL Editor (см. инструкцию).</small>
      </div>

      <!-- Список комнат -->
      <div style="background:#fff; border-bottom:1px solid #e0e8f4; flex-shrink:0;">
        <div style="overflow-x:auto; display:flex; gap:8px; padding:10px 16px; scrollbar-width:none;">
          <div v-for="room in rooms" :key="room.id"
               style="flex-shrink:0; cursor:pointer;" @click="selectRoom(room.id)">
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px; min-width:56px;">
              <div style="position:relative; display:inline-block;">
                <div class="avatar"
                     :style="{
                       background: room.user ? room.user.color : '#08205e',
                       outline: roomId===room.id ? '2px solid #f7d894' : '2px solid transparent',
                       outlineOffset: '2px'
                     }">
                  {{ room.user ? room.user.short : '👥' }}
                </div>
                <!-- Онлайн-индикатор -->
                <span v-if="room.user && isOnline(room.user.id)"
                      style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#38a169; border-radius:50%; border:2px solid #fff;"></span>
                <!-- Бейдж непрочитанных -->
                <span v-if="unreadCount(room.id) > 0"
                      style="position:absolute; top:-4px; right:-4px; background:#e53e3e; color:#fff; border-radius:10px; min-width:18px; height:18px; font-size:10px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-weight:700; padding:0 3px; line-height:1;">
                  {{ unreadCount(room.id) > 9 ? '9+' : unreadCount(room.id) }}
                </span>
              </div>
              <span style="font-size:10px; color:#4a5a7a; text-align:center; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                {{ room.id==='all' ? 'Все' : room.label }}
              </span>
              <!-- Превью последнего сообщения -->
              <span style="font-size:9px; color:#8a9aba; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; display:block; min-height:12px;">
                {{ lastMessage(room.id) ? (lastMessage(room.id).media_type === 'image' ? '📷 Фото' : (lastMessage(room.id).text ? lastMessage(room.id).text.slice(0, 16) : '')) : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Заголовок комнаты -->
      <div style="background:#08205e; padding:10px 16px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <div class="avatar avatar-sm" :style="{ background: currentRoom?.user?.color || '#0d2d7a' }">
          {{ currentRoom?.user?.short || '👥' }}
        </div>
        <div>
          <div style="font-size:14px; font-weight:600; color:#fff;">{{ currentRoom?.label }}</div>
          <div style="font-size:11px; color:rgba(247,216,148,.7);">{{ currentRoom?.sub }}</div>
        </div>
      </div>

      <!-- Лента сообщений -->
      <div style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:12px 16px; background:#f0f4fb;">
        <div v-if="currentMessages.length===0"
             style="text-align:center; color:#8a9aba; padding:48px 0; font-size:14px;">
          Нет сообщений. Напишите первым! 👋
        </div>

        <template v-for="item in messagesWithDates" :key="item.type === 'date' ? ('date-' + item.date) : item.id">

          <!-- Разделитель даты -->
          <div v-if="item.type === 'date'"
               style="text-align:center; margin:14px 0 10px; display:flex; align-items:center; gap:8px;">
            <div style="flex:1; height:1px; background:#d8e2f0;"></div>
            <span style="background:#d8e2f0; color:#4a5a7a; font-size:11px; padding:3px 10px; border-radius:10px; white-space:nowrap;">
              {{ item.label }}
            </span>
            <div style="flex:1; height:1px; background:#d8e2f0;"></div>
          </div>

          <!-- Сообщение -->
          <div v-else :style="{
            display:'flex',
            justifyContent: item.sender_id===user.id ? 'flex-end' : 'flex-start',
            marginBottom:'10px'
          }">
            <div style="display:flex; flex-direction:column; max-width:78%;">

              <span v-if="item.sender_id !== user.id"
                    style="font-size:11px; color:#4a5a7a; font-weight:600; margin-bottom:3px; padding-left:4px;">
                {{ item.sender_name }}
              </span>

              <!-- Фото -->
              <div v-if="item.media_type==='image' && item.media_data" style="margin-bottom:4px;">
                <img :src="item.media_data"
                     style="max-width:220px; max-height:220px; border-radius:12px; display:block; object-fit:cover; cursor:zoom-in;"
                     @click="openLightbox(item.media_data)">
              </div>

              <!-- Текст -->
              <div v-if="item.text"
                   class="chat-bubble"
                   :class="item.sender_id===user.id ? 'bubble-out' : 'bubble-in'">
                {{ item.text }}
              </div>

              <!-- Время + кнопка удаления -->
              <div :style="{ display:'flex', alignItems:'center', gap:'4px', justifyContent: item.sender_id===user.id ? 'flex-end' : 'flex-start' }">
                <div class="bubble-time">{{ formatTime(item.created_at) }}</div>
                <button v-if="item.sender_id === user.id"
                        @click="deleteMsg(item.id)"
                        title="Удалить"
                        style="background:none; border:none; font-size:11px; color:#c53030; cursor:pointer; padding:0 2px; opacity:0.5; line-height:1; flex-shrink:0;">
                  ✕
                </button>
              </div>
            </div>
          </div>

        </template>

        <div ref="msgEnd"></div>
      </div>

      <!-- Превью фото -->
      <div v-if="mediaPreview"
           style="background:#fff; border-top:1px solid #e0e8f4; padding:8px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <img :src="mediaPreview.url"
             style="height:60px; width:60px; border-radius:8px; object-fit:cover; flex-shrink:0;">
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:600; color:#1a2a4a;">📷 Фото</div>
          <div style="font-size:11px; color:#8a9aba;">Готово к отправке</div>
        </div>
        <button @click="cancelMedia"
                style="background:none; border:none; font-size:22px; color:#8a9aba; cursor:pointer; padding:4px; flex-shrink:0;">✕</button>
      </div>

      <!-- Строка ввода -->
      <div class="chat-input-row" style="flex-shrink:0; gap:6px;">
        <input ref="photoInput" type="file" accept="image/*"
               style="display:none;" @change="onPhotoSelected">

        <button @click="triggerPhoto"
                title="Фото"
                style="background:none; border:none; font-size:22px; cursor:pointer; padding:4px 6px; color:#08205e; flex-shrink:0; line-height:1;">
          📷
        </button>

        <textarea class="form-control"
                  v-model="newMsg"
                  placeholder="Сообщение..."
                  rows="1"
                  style="flex:1; resize:none; max-height:100px; line-height:1.4; padding:10px 12px;"
                  @keydown="handleKey"></textarea>

        <button class="btn btn-primary"
                style="flex-shrink:0; height:42px; min-width:42px; padding:0 12px;"
                :disabled="uploading || (!newMsg.trim() && !mediaPreview)"
                :style="{ opacity: (uploading || (!newMsg.trim() && !mediaPreview)) ? .5 : 1 }"
                @click="send">
          {{ uploading ? '⏳' : '➤' }}
        </button>
      </div>

      <!-- Лайтбокс -->
      <div v-if="lightbox"
           @click="closeLightbox"
           style="position:fixed; inset:0; background:rgba(0,0,0,.93); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:zoom-out;">
        <img :src="lightbox"
             style="max-width:95vw; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,.6);">
        <button @click.stop="closeLightbox"
                style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:22px; width:44px; height:44px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          ✕
        </button>
      </div>

    </div>
  `,
});
})();
