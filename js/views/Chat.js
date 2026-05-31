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

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1048576).toFixed(1) + ' МБ';
}

function fileIcon(mime) {
  if (!mime) return '📎';
  if (mime.startsWith('image/'))       return '🖼️';
  if (mime.startsWith('video/'))       return '🎬';
  if (mime.startsWith('audio/'))       return '🎵';
  if (mime === 'application/pdf')      return '📄';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('excel') || mime.includes('sheet'))   return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return '🗜️';
  return '📎';
}

function downloadFile(mediaData) {
  try {
    const info = JSON.parse(mediaData);
    const a = document.createElement('a');
    a.href = info.b64;
    a.download = info.name;
    a.click();
  } catch (e) {
    // fallback для старых записей
    const a = document.createElement('a');
    a.href = mediaData;
    a.download = 'file';
    a.click();
  }
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
    const fileInput    = ref(null);
    const loadError    = ref(null);
    const onlineSet    = Vue.reactive(new Set());

    const readAt = ref(JSON.parse(localStorage.getItem('be3_read_at') || '{}'));

    const contextMenu = ref(null);
    const replyTo     = ref(null);
    const textareaRef = ref(null);
    const REACTIONS   = ['👍', '❤️', '😜', '🔥', '😭', '😍'];
    let pressTimer = null;

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

    const currentRoom     = computed(() => rooms.value.find(r => r.id === roomId.value));
    const currentMessages = computed(() => messages.value.filter(m => m.room_id === roomId.value));

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

    function lastMessage(rid) {
      const roomMsgs = messages.value.filter(m => m.room_id === rid);
      return roomMsgs[roomMsgs.length - 1] || null;
    }

    function markRead(rid) {
      readAt.value[rid] = new Date().toISOString();
      localStorage.setItem('be3_read_at', JSON.stringify(readAt.value));
    }

    function unreadCount(rid) {
      const since = readAt.value[rid];
      return messages.value.filter(function(m) {
        return m.room_id === rid && m.sender_id !== user.value.id && (!since || m.created_at > since);
      }).length;
    }

    // Получить инфо о файле из media_data
    function fileInfo(msg) {
      if (msg.media_type !== 'file') return null;
      try { return JSON.parse(msg.media_data); }
      catch (e) { return { name: 'Файл', size: 0, mime: '', b64: msg.media_data }; }
    }

    let channel = null;

    async function loadMessages() {
      const { data, error } = await db
        .from('messages').select('*')
        .order('created_at', { ascending: true }).limit(300);
      if (error) { loadError.value = error.message; }
      else { messages.value = data || []; nextTick(scrollToBottom); }
    }

    function subscribeRealtime() {
      channel = db.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          const exists = messages.value.find(m => m.id === payload.new.id);
          if (!exists) messages.value.push(payload.new);
          if (payload.new.room_id === roomId.value) nextTick(scrollToBottom);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
          if (payload.old && payload.old.id)
            messages.value = messages.value.filter(m => m.id !== payload.old.id);
        })
        .subscribe();
    }

    onMounted(async () => { await loadMessages(); markRead(roomId.value); subscribeRealtime(); });
    onUnmounted(() => { if (channel) db.removeChannel(channel); });

    function selectRoom(rid) { roomId.value = rid; markRead(rid); nextTick(scrollToBottom); }
    function scrollToBottom() { if (msgEnd.value) msgEnd.value.scrollIntoView({ behavior: 'smooth' }); }

    async function deleteMsg(id) {
      messages.value = messages.value.filter(m => m.id !== id);
      const { error } = await db.from('messages').delete().eq('id', id);
      if (error) { alert('Ошибка удаления: ' + error.message); loadMessages(); }
    }

    // ── Контекстное меню ────────────────────────────────────
    function parseReply(text) {
      if (!text || !text.startsWith('> ')) return { quote: null, body: text };
      const lines = text.split('\n');
      const quoteLines = [];
      let i = 0;
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      if (i < lines.length && lines[i] === '') i++;
      return { quote: quoteLines.join('\n'), body: lines.slice(i).join('\n') };
    }

    function showMenu(msg) {
      if (navigator.vibrate) navigator.vibrate(30);
      contextMenu.value = msg;
    }

    function startPress(msg) {
      pressTimer = setTimeout(function () { showMenu(msg); pressTimer = null; }, 500);
    }

    function endPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }

    function closeMenu() { contextMenu.value = null; }

    function menuCopy() {
      if (contextMenu.value && contextMenu.value.text) {
        navigator.clipboard.writeText(parseReply(contextMenu.value.text).body).catch(function () {});
      }
      closeMenu();
    }

    function menuReply() {
      replyTo.value = contextMenu.value;
      closeMenu();
      nextTick(function () { if (textareaRef.value) textareaRef.value.focus(); });
    }

    function cancelReply() { replyTo.value = null; }

    async function menuDelete() {
      const id = contextMenu.value.id;
      closeMenu();
      await deleteMsg(id);
    }

    async function menuReact(emoji) {
      const msg = contextMenu.value;
      closeMenu();
      await db.from('messages').insert({
        room_id:      msg.room_id,
        sender_id:    user.value.id,
        sender_name:  user.value.name,
        sender_short: user.value.short,
        sender_color: user.value.color,
        text:         emoji,
        media_data:   null,
        media_type:   null,
      });
    }

    // ── Камера (фото / видео) ────────────────────────────────
    function triggerPhoto() { if (photoInput.value) photoInput.value.click(); }

    async function onPhotoSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      if (file.type.startsWith('video/')) {
        const MAX = 25 * 1024 * 1024; // 25 МБ ≈ 10–15 сек
        if (file.size > MAX) { alert('Видео слишком большое. Максимум 25 МБ (~15 сек).'); return; }
        const url = URL.createObjectURL(file);
        if (mediaPreview.value && mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
        mediaPreview.value = { type: 'file', name: file.name, size: file.size, mime: file.type, file, url };
        return;
      }

      const blob = await compressImage(file);
      const url  = URL.createObjectURL(blob);
      if (mediaPreview.value && mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = { url, blob, type: 'image', name: file.name };
    }

    // ── Файл (скрепка) ───────────────────────────────────────
    function triggerFile() { if (fileInput.value) fileInput.value.click(); }

    async function onFileSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      const MAX = 10 * 1024 * 1024; // 10 МБ
      if (file.size > MAX) {
        alert('Файл слишком большой. Максимум 10 МБ.');
        return;
      }

      // Если картинка — сжимаем как обычно
      if (file.type.startsWith('image/')) {
        const blob = await compressImage(file);
        const url  = URL.createObjectURL(blob);
        if (mediaPreview.value && mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
        mediaPreview.value = { url, blob, type: 'image', name: file.name };
        return;
      }

      // Иначе — читаем как base64
      if (mediaPreview.value && mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
      mediaPreview.value = { type: 'file', name: file.name, size: file.size, mime: file.type, file };
    }

    function cancelMedia() {
      if (mediaPreview.value && mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
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
        if (mediaPreview.value.type === 'image') {
          media_data = await blobToBase64(mediaPreview.value.blob);
          media_type = 'image';
          if (mediaPreview.value.url) URL.revokeObjectURL(mediaPreview.value.url);
        } else if (mediaPreview.value.type === 'file') {
          const b64 = await blobToBase64(mediaPreview.value.file);
          media_data = JSON.stringify({
            name: mediaPreview.value.name,
            size: mediaPreview.value.size,
            mime: mediaPreview.value.mime,
            b64,
          });
          media_type = 'file';
        }
        mediaPreview.value = null;
      }

      let fullText = text || null;
      if (fullText && replyTo.value) {
        const preview = parseReply(replyTo.value.text || '').body || '📎';
        fullText = '> ' + replyTo.value.sender_name + ': ' + preview.slice(0, 60) + '\n\n' + fullText;
      }
      replyTo.value = null;

      const { error } = await db.from('messages').insert({
        room_id:      roomId.value,
        sender_id:    user.value.id,
        sender_name:  user.value.name,
        sender_short: user.value.short,
        sender_color: user.value.color,
        text:         fullText,
        media_data,
        media_type,
      });

      if (error) alert('Ошибка отправки: ' + error.message);

      if (!error) {
        const notifText = text || (media_type === 'file' ? '📎 Файл' : '📷 Фото');
        fetch('https://ntfy.sh/bargut-emchi-2026', {
          method: 'POST',
          headers: { 'Title': user.value.name, 'Priority': 'default', 'Tags': 'hospital' },
          body: notifText,
        }).catch(() => {});
      }

      newMsg.value = '';
      uploading.value = false;
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    function openLightbox(src)  { lightbox.value = src; }
    function closeLightbox()    { lightbox.value = null; }

    return {
      user, roomId, rooms, currentRoom, currentMessages, messagesWithDates,
      newMsg, msgEnd, photoInput, fileInput, textareaRef,
      mediaPreview, uploading, lightbox, loadError,
      contextMenu, replyTo, REACTIONS,
      selectRoom, send, handleKey,
      triggerPhoto, onPhotoSelected, triggerFile, onFileSelected, cancelMedia,
      openLightbox, closeLightbox, deleteMsg,
      formatTime: window.formatTime,
      isOnline, unreadCount, lastMessage, fileInfo, fileIcon, formatSize, downloadFile,
      parseReply, showMenu, startPress, endPress, closeMenu,
      menuCopy, menuReply, menuDelete, menuReact, cancelReply,
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
                <span v-if="room.user && isOnline(room.user.id)"
                      style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#38a169; border-radius:50%; border:2px solid #fff;"></span>
                <span v-if="unreadCount(room.id) > 0"
                      style="position:absolute; top:-4px; right:-4px; background:#e53e3e; color:#fff; border-radius:10px; min-width:18px; height:18px; font-size:10px; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-weight:700; padding:0 3px; line-height:1;">
                  {{ unreadCount(room.id) > 9 ? '9+' : unreadCount(room.id) }}
                </span>
              </div>
              <span style="font-size:10px; color:#4a5a7a; text-align:center; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                {{ room.id==='all' ? 'Все' : room.label }}
              </span>
              <span style="font-size:9px; color:#8a9aba; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; display:block; min-height:12px;">
                {{ lastMessage(room.id) ? (lastMessage(room.id).media_type === 'image' ? '📷 Фото' : lastMessage(room.id).media_type === 'file' ? '📎 Файл' : (lastMessage(room.id).text ? lastMessage(room.id).text.slice(0, 16) : '')) : '' }}
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
            <span style="background:#d8e2f0; color:#4a5a7a; font-size:11px; padding:3px 10px; border-radius:10px; white-space:nowrap;">{{ item.label }}</span>
            <div style="flex:1; height:1px; background:#d8e2f0;"></div>
          </div>

          <!-- Сообщение -->
          <div v-else :style="{ display:'flex', justifyContent: item.sender_id===user.id ? 'flex-end' : 'flex-start', marginBottom:'10px' }"
               @touchstart.passive="startPress(item)" @touchend="endPress()" @touchmove="endPress()"
               @contextmenu.prevent="showMenu(item)"
               style="-webkit-touch-callout:none; user-select:none;">
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

              <!-- Видео -->
              <div v-if="item.media_type==='file' && item.media_data && fileInfo(item) && fileInfo(item).mime && fileInfo(item).mime.startsWith('video/')"
                   style="margin-bottom:4px;">
                <video :src="fileInfo(item).b64" controls playsinline
                       style="max-width:260px; max-height:200px; border-radius:12px; display:block; background:#000;"></video>
              </div>

              <!-- Файл -->
              <div v-else-if="item.media_type==='file' && item.media_data"
                   style="margin-bottom:4px; cursor:pointer;"
                   @click="downloadFile(item.media_data)">
                <div :style="{
                  display:'flex', alignItems:'center', gap:'10px',
                  padding:'10px 14px', borderRadius:'12px',
                  background: item.sender_id===user.id ? '#08205e' : '#fff',
                  border: item.sender_id===user.id ? 'none' : '1px solid #d8e2f0',
                  maxWidth:'240px'
                }">
                  <span style="font-size:26px; flex-shrink:0;">{{ fileIcon(fileInfo(item) && fileInfo(item).mime) }}</span>
                  <div style="overflow:hidden;">
                    <div :style="{ fontSize:'13px', fontWeight:'600', color: item.sender_id===user.id ? '#fff' : '#1a2a4a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">
                      {{ fileInfo(item) ? fileInfo(item).name : 'Файл' }}
                    </div>
                    <div :style="{ fontSize:'11px', color: item.sender_id===user.id ? 'rgba(255,255,255,.65)' : '#8a9aba' }">
                      {{ fileInfo(item) ? formatSize(fileInfo(item).size) : '' }} · Нажмите для скачивания
                    </div>
                  </div>
                </div>
              </div>

              <!-- Текст -->
              <div v-if="item.text"
                   class="chat-bubble"
                   :class="item.sender_id===user.id ? 'bubble-out' : 'bubble-in'">
                <div v-if="parseReply(item.text).quote"
                     :style="{ borderLeft: '3px solid ' + (item.sender_id===user.id ? 'rgba(255,255,255,.5)' : '#08205e'), paddingLeft:'8px', marginBottom:'6px', fontSize:'12px', opacity:'0.75', borderRadius:'2px', whiteSpace:'pre-wrap' }">
                  {{ parseReply(item.text).quote }}
                </div>
                {{ parseReply(item.text).body }}
              </div>

              <!-- Время -->
              <div :style="{ display:'flex', alignItems:'center', gap:'4px', justifyContent: item.sender_id===user.id ? 'flex-end' : 'flex-start' }">
                <div class="bubble-time">{{ formatTime(item.created_at) }}</div>
              </div>
            </div>
          </div>

        </template>
        <div ref="msgEnd"></div>
      </div>

      <!-- Превью перед отправкой -->
      <div v-if="mediaPreview"
           style="background:#fff; border-top:1px solid #e0e8f4; padding:8px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <!-- Превью фото -->
        <template v-if="mediaPreview.type === 'image'">
          <img :src="mediaPreview.url" style="height:60px; width:60px; border-radius:8px; object-fit:cover; flex-shrink:0;">
          <div style="flex:1;">
            <div style="font-size:13px; font-weight:600; color:#1a2a4a;">📷 Фото</div>
            <div style="font-size:11px; color:#8a9aba;">Готово к отправке</div>
          </div>
        </template>
        <!-- Превью видео -->
        <template v-else-if="mediaPreview.type === 'file' && mediaPreview.mime && mediaPreview.mime.startsWith('video/')">
          <video :src="mediaPreview.url" style="height:60px; width:90px; border-radius:8px; object-fit:cover; flex-shrink:0;" muted playsinline></video>
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:13px; font-weight:600; color:#1a2a4a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ mediaPreview.name }}</div>
            <div style="font-size:11px; color:#8a9aba;">{{ formatSize(mediaPreview.size) }} · Видео</div>
          </div>
        </template>
        <!-- Превью файла -->
        <template v-else-if="mediaPreview.type === 'file'">
          <span style="font-size:32px; flex-shrink:0;">{{ fileIcon(mediaPreview.mime) }}</span>
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:13px; font-weight:600; color:#1a2a4a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ mediaPreview.name }}</div>
            <div style="font-size:11px; color:#8a9aba;">{{ formatSize(mediaPreview.size) }} · Готово к отправке</div>
          </div>
        </template>
        <button @click="cancelMedia"
                style="background:none; border:none; font-size:22px; color:#8a9aba; cursor:pointer; padding:4px; flex-shrink:0;">✕</button>
      </div>

      <!-- Ответ на сообщение -->
      <div v-if="replyTo"
           style="background:#fff; border-top:1px solid #e0e8f4; padding:8px 14px; display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <div style="border-left:3px solid #08205e; padding-left:10px; flex:1; overflow:hidden;">
          <div style="font-size:11px; font-weight:700; color:#08205e;">↩️ {{ replyTo.sender_name }}</div>
          <div style="font-size:12px; color:#4a5a7a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            {{ (replyTo.text ? parseReply(replyTo.text).body : '') || '📎 Медиа' }}
          </div>
        </div>
        <button @click="cancelReply" style="background:none; border:none; font-size:20px; color:#8a9aba; cursor:pointer; padding:4px; flex-shrink:0;">✕</button>
      </div>

      <!-- Строка ввода -->
      <div class="chat-input-row" style="flex-shrink:0; gap:6px;">
        <input ref="photoInput" type="file" accept="image/*,video/*" capture="environment" style="display:none;" @change="onPhotoSelected">
        <input ref="fileInput"  type="file" accept="*/*" style="display:none;" @change="onFileSelected">

        <button @click="triggerFile" title="Камера"
                style="background:none; border:none; font-size:22px; cursor:pointer; padding:4px 6px; color:#08205e; flex-shrink:0; line-height:1;">
          📷
        </button>
        <button @click="triggerPhoto" title="Прикрепить файл"
                style="background:none; border:none; font-size:22px; cursor:pointer; padding:4px 6px; color:#08205e; flex-shrink:0; line-height:1;">
          📎
        </button>

        <textarea ref="textareaRef"
                  class="form-control"
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

      <!-- Контекстное меню сообщения -->
      <div v-if="contextMenu" @click.self="closeMenu"
           style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9000; display:flex; flex-direction:column; justify-content:flex-end; touch-action:none;">
        <!-- Реакции -->
        <div style="display:flex; justify-content:center; gap:10px; padding:14px 20px 12px; background:#1c2d50; border-radius:20px 20px 0 0; margin-bottom:2px;">
          <span v-for="emoji in REACTIONS" :key="emoji"
                @click="menuReact(emoji)"
                style="font-size:32px; cursor:pointer; line-height:1; padding:4px;">{{ emoji }}</span>
        </div>
        <!-- Пункты меню -->
        <div style="background:#fff; overflow:hidden; padding-bottom:env(safe-area-inset-bottom, 8px);">
          <div @click="menuReply"
               style="display:flex; align-items:center; gap:16px; padding:16px 20px; border-bottom:1px solid #f0f4fb; cursor:pointer; font-size:16px; color:#1a2a4a; -webkit-tap-highlight-color:rgba(0,0,0,.06);">
            <span style="width:26px; text-align:center; font-size:20px;">↩️</span> Ответить
          </div>
          <div v-if="contextMenu.text" @click="menuCopy"
               style="display:flex; align-items:center; gap:16px; padding:16px 20px; border-bottom:1px solid #f0f4fb; cursor:pointer; font-size:16px; color:#1a2a4a; -webkit-tap-highlight-color:rgba(0,0,0,.06);">
            <span style="width:26px; text-align:center; font-size:20px;">📋</span> Скопировать текст
          </div>
          <div v-if="contextMenu.sender_id === user.id" @click="menuDelete"
               style="display:flex; align-items:center; gap:16px; padding:16px 20px; cursor:pointer; font-size:16px; color:#e53e3e; -webkit-tap-highlight-color:rgba(229,62,62,.1);">
            <span style="width:26px; text-align:center; font-size:20px;">🗑️</span> Удалить
          </div>
        </div>
      </div>

      <!-- Лайтбокс -->
      <div v-if="lightbox" @click="closeLightbox"
           style="position:fixed; inset:0; background:rgba(0,0,0,.93); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:zoom-out;">
        <img :src="lightbox" style="max-width:95vw; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,.6);">
        <button @click.stop="closeLightbox"
                style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,.12); border:none; color:#fff; font-size:22px; width:44px; height:44px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          ✕
        </button>
      </div>

    </div>
  `,
});
})();
