/* global Vue, APP_STATE, APP_USERS, getUser, nextId, formatTime */
(function () {
const { defineComponent, ref, computed, reactive, nextTick, onMounted } = Vue;

// ── Утилиты медиафайлов ──────────────────────────────────────

function compressImage(file, maxPx = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror          = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

// ── Компонент чата ───────────────────────────────────────────

window.ChatView = defineComponent({
  name: 'Chat',

  setup() {
    const state  = window.APP_STATE;
    const USERS  = window.APP_USERS;
    const user   = computed(() => state.currentUser);
    const roomId = ref('all');
    const newMsg = ref('');
    const msgEnd = ref(null);

    // Рефы на скрытые input[file]
    const photoInput = ref(null);
    const videoInput = ref(null);

    // Превью выбранного файла до отправки
    const mediaPreview = ref(null); // { url, blob, type }

    // Карта mediaId → objectURL для показа в сообщениях
    const mediaUrls = reactive({});

    const uploading = ref(false);

    // Лайтбокс (полный экран для фото)
    const lightbox = ref(null);

    // ── Комнаты ──────────────────────────────────────────────
    const rooms = computed(() => {
      const personal = USERS
        .filter(u => u.id !== user.value.id)
        .map(u => ({ id: 'u_' + u.id, label: u.name, sub: u.roleLabel, user: u }));
      return [
        { id: 'all', label: 'Все сотрудники', sub: 'Общий чат', user: null },
        ...personal,
      ];
    });

    const currentRoom = computed(() => rooms.value.find(r => r.id === roomId.value));

    const messages = computed(() =>
      state.messages
        .filter(m => m.roomId === roomId.value)
        .sort((a, b) => a.time.localeCompare(b.time))
    );

    // ── Медиа: загрузка из IndexedDB ─────────────────────────
    async function loadMediaUrl(mediaId) {
      if (!mediaId || mediaUrls[mediaId]) return;
      try {
        const record = await window.MediaDB.load(mediaId);
        if (record) mediaUrls[mediaId] = URL.createObjectURL(record.blob);
      } catch { /* файл мог быть удалён */ }
    }

    async function loadAllMedia() {
      for (const m of state.messages) {
        if (m.mediaId) await loadMediaUrl(m.mediaId);
      }
    }

    onMounted(loadAllMedia);

    // ── Навигация по комнатам ─────────────────────────────────
    function selectRoom(rid) {
      roomId.value = rid;
      nextTick(scrollToBottom);
    }

    function scrollToBottom() {
      if (msgEnd.value) msgEnd.value.scrollIntoView({ behavior: 'smooth' });
    }

    // ── Выбор файлов ─────────────────────────────────────────
    function triggerPhoto() { photoInput.value.click(); }
    function triggerVideo() { videoInput.value.click(); }

    async function onPhotoSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      const blob = await compressImage(file);
      const url  = URL.createObjectURL(blob);
      if (mediaPreview.value) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = { url, blob, type: 'image' };
    }

    async function onVideoSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      const duration = await getVideoDuration(file);
      if (duration > 15) {
        alert('Видео должно быть не длиннее 15 секунд.\nВыберите другой файл.');
        return;
      }
      const url = URL.createObjectURL(file);
      if (mediaPreview.value) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = { url, blob: file, type: 'video' };
    }

    function cancelMedia() {
      if (mediaPreview.value) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = null;
    }

    // ── Отправка ──────────────────────────────────────────────
    async function send() {
      const text = newMsg.value.trim();
      if (!text && !mediaPreview.value) return;

      let mediaId   = null;
      let mediaType = null;

      if (mediaPreview.value) {
        uploading.value = true;
        try {
          mediaId   = await window.MediaDB.save(mediaPreview.value.blob, mediaPreview.value.type);
          mediaType = mediaPreview.value.type;
          // Переносим object URL в карту — не создаём новый
          mediaUrls[mediaId] = mediaPreview.value.url;
          mediaPreview.value = null; // URL уже в карте, не отзываем
        } catch {
          alert('Не удалось сохранить медиафайл. Попробуйте ещё раз.');
          uploading.value = false;
          return;
        }
        uploading.value = false;
      }

      state.messages.push({
        id:        window.nextId(state.messages),
        roomId:    roomId.value,
        senderId:  user.value.id,
        text,
        time:      new Date().toISOString(),
        read:      false,
        mediaId,
        mediaType,
      });

      newMsg.value = '';
      nextTick(scrollToBottom);
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    // ── Лайтбокс ─────────────────────────────────────────────
    function openLightbox(mediaId) {
      if (mediaUrls[mediaId]) lightbox.value = mediaUrls[mediaId];
    }
    function closeLightbox() { lightbox.value = null; }

    return {
      user, roomId, rooms, currentRoom, messages,
      newMsg, msgEnd,
      photoInput, videoInput,
      mediaPreview, mediaUrls, uploading,
      lightbox,
      selectRoom, send, handleKey,
      triggerPhoto, triggerVideo, onPhotoSelected, onVideoSelected, cancelMedia,
      openLightbox, closeLightbox,
      getUser: window.getUser, formatTime: window.formatTime,
    };
  },

  template: `
    <div style="display:flex; flex-direction:column; height:calc(100vh - 116px); margin:-16px; overflow:hidden;">

      <!-- Список комнат (горизонтальный скролл) -->
      <div style="background:#fff; border-bottom:1px solid #e0e8f4; flex-shrink:0;">
        <div style="overflow-x:auto; display:flex; gap:8px; padding:10px 16px; scrollbar-width:none;">
          <div v-for="room in rooms" :key="room.id"
               style="flex-shrink:0; cursor:pointer;" @click="selectRoom(room.id)">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px; min-width:56px;">
              <div class="avatar"
                   :style="{
                     background: room.user ? room.user.color : '#08205e',
                     outline: roomId===room.id ? '2px solid #f7d894' : '2px solid transparent',
                     outlineOffset: '2px'
                   }">
                {{ room.user ? room.user.short : '👥' }}
              </div>
              <span style="font-size:10px; color:#4a5a7a; text-align:center; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                {{ room.id==='all' ? 'Все' : room.label }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Заголовок комнаты -->
      <div style="background:#08205e; padding:10px 16px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <div class="avatar avatar-sm"
             :style="{ background: currentRoom?.user?.color || '#0d2d7a' }">
          {{ currentRoom?.user?.short || '👥' }}
        </div>
        <div>
          <div style="font-size:14px; font-weight:600; color:#fff;">{{ currentRoom?.label }}</div>
          <div style="font-size:11px; color:rgba(247,216,148,.7);">{{ currentRoom?.sub }}</div>
        </div>
      </div>

      <!-- Лента сообщений -->
      <div style="flex:1; overflow-y:auto; padding:12px 16px; background:#f0f4fb;">
        <div v-if="messages.length===0"
             style="text-align:center; color:#8a9aba; padding:48px 0; font-size:14px;">
          Нет сообщений. Напишите первым! 👋
        </div>

        <template v-for="msg in messages" :key="msg.id">
          <div :style="{
            display:'flex',
            justifyContent: msg.senderId===user.id ? 'flex-end' : 'flex-start',
            marginBottom: '10px'
          }">
            <div style="display:flex; flex-direction:column; max-width:78%;">

              <!-- Имя отправителя (чужие сообщения) -->
              <span v-if="msg.senderId !== user.id"
                    style="font-size:11px; color:#4a5a7a; font-weight:600; margin-bottom:3px; padding-left:4px;">
                {{ getUser(msg.senderId)?.name }}
              </span>

              <!-- Фото -->
              <div v-if="msg.mediaType==='image'" style="margin-bottom:4px;">
                <img v-if="mediaUrls[msg.mediaId]"
                     :src="mediaUrls[msg.mediaId]"
                     style="max-width:220px; max-height:220px; border-radius:12px; display:block; object-fit:cover; cursor:zoom-in;"
                     @click="openLightbox(msg.mediaId)">
                <div v-else
                     style="width:120px; height:80px; background:#dde6f4; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px;">
                  📷
                </div>
              </div>

              <!-- Видео -->
              <div v-if="msg.mediaType==='video'" style="margin-bottom:4px;">
                <video v-if="mediaUrls[msg.mediaId]"
                       :src="mediaUrls[msg.mediaId]"
                       controls playsinline preload="metadata"
                       style="max-width:260px; border-radius:12px; display:block; background:#000;"></video>
                <div v-else
                     style="width:180px; height:100px; background:#dde6f4; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px;">
                  🎥
                </div>
              </div>

              <!-- Текст -->
              <div v-if="msg.text"
                   class="chat-bubble"
                   :class="msg.senderId===user.id ? 'bubble-out' : 'bubble-in'">
                {{ msg.text }}
              </div>

              <div class="bubble-time">{{ formatTime(msg.time) }}</div>
            </div>
          </div>
        </template>

        <div ref="msgEnd"></div>
      </div>

      <!-- Превью выбранного медиафайла -->
      <div v-if="mediaPreview"
           style="background:#fff; border-top:1px solid #e0e8f4; padding:8px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <img v-if="mediaPreview.type==='image'"
             :src="mediaPreview.url"
             style="height:60px; width:60px; border-radius:8px; object-fit:cover; flex-shrink:0;">
        <video v-else
               :src="mediaPreview.url"
               preload="metadata" muted
               style="height:60px; border-radius:8px; flex-shrink:0;"></video>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; font-weight:600; color:#1a2a4a;">
            {{ mediaPreview.type==='image' ? '📷 Фото' : '🎥 Видео' }}
          </div>
          <div style="font-size:11px; color:#8a9aba;">Готово к отправке</div>
        </div>
        <button @click="cancelMedia"
                style="background:none; border:none; font-size:22px; color:#8a9aba; cursor:pointer; padding:4px; flex-shrink:0;">✕</button>
      </div>

      <!-- Строка ввода -->
      <div class="chat-input-row" style="flex-shrink:0; gap:6px;">

        <!-- Скрытые инпуты файлов -->
        <input ref="photoInput" type="file" accept="image/*"
               style="display:none;" @change="onPhotoSelected">
        <input ref="videoInput" type="file" accept="video/*"
               style="display:none;" @change="onVideoSelected">

        <!-- Кнопка фото -->
        <button @click="triggerPhoto"
                title="Прикрепить фото"
                style="background:none; border:none; font-size:22px; cursor:pointer; padding:4px 5px; color:#08205e; flex-shrink:0; line-height:1;">
          📷
        </button>

        <!-- Кнопка видео (≤15 сек) -->
        <button @click="triggerVideo"
                title="Прикрепить видео (до 15 сек)"
                style="background:none; border:none; font-size:22px; cursor:pointer; padding:4px 5px; color:#08205e; flex-shrink:0; line-height:1;">
          🎥
        </button>

        <!-- Поле ввода текста -->
        <textarea class="form-control"
                  v-model="newMsg"
                  placeholder="Сообщение..."
                  rows="1"
                  style="flex:1; resize:none; max-height:100px; line-height:1.4; padding:10px 12px;"
                  @keydown="handleKey"></textarea>

        <!-- Отправить -->
        <button class="btn btn-primary"
                style="flex-shrink:0; height:42px; min-width:42px; padding:0 12px;"
                :disabled="uploading || (!newMsg.trim() && !mediaPreview)"
                :style="{ opacity: (uploading || (!newMsg.trim() && !mediaPreview)) ? .5 : 1 }"
                @click="send">
          {{ uploading ? '⏳' : '➤' }}
        </button>
      </div>

      <!-- Лайтбокс — полноэкранный просмотр фото -->
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
