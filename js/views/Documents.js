/* global Vue, APP_STATE, canManage, nextId */
const { defineComponent, ref, computed } = Vue;

const FOLDERS = [
  { key:'instructions', icon:'📋', label:'Должностные инструкции',  color:'#EBF8FF' },
  { key:'sanpin',       icon:'🏥', label:'СанПиНы и требования',    color:'#F0FFF4' },
  { key:'orders',       icon:'📜', label:'Приказы и распоряжения',   color:'#FFFBEB' },
  { key:'other',        icon:'📂', label:'Прочие документы',         color:'#FAF5FF' },
];

const FILE_ICONS = { pdf:'📄', docx:'📝', xlsx:'📊', pptx:'📊', jpg:'🖼️', png:'🖼️' };

window.DocumentsView = defineComponent({
  name: 'Documents',
  setup() {
    const state        = window.APP_STATE;
    const user         = computed(() => state.currentUser);
    const activeFolder = ref(null);
    const showUpload   = ref(false);
    const newDoc = ref({ name:'', folder:'other', type:'pdf', size:'—' });

    const folderDocs = computed(() =>
      activeFolder.value
        ? state.documents.filter(d => d.folder === activeFolder.value)
        : []
    );

    const folderCount    = (key) => state.documents.filter(d => d.folder === key).length;
    const currentFolder  = computed(() => FOLDERS.find(f => f.key === activeFolder.value));

    function openFolder(key)  { activeFolder.value = key; }
    function closeFolder()    { activeFolder.value = null; }

    function addDoc() {
      if (!newDoc.value.name.trim()) return;
      state.documents.push({
        id:       window.nextId(state.documents),
        folder:   activeFolder.value || newDoc.value.folder,
        name:     newDoc.value.name.trim(),
        type:     newDoc.value.type,
        size:     newDoc.value.size || '—',
        date:     new Date().toLocaleDateString('ru-RU'),
        authorId: user.value.id,
      });
      newDoc.value = { name:'', folder: activeFolder.value || 'other', type:'pdf', size:'—' };
      showUpload.value = false;
    }

    function removeDoc(id) {
      const idx = state.documents.findIndex(d => d.id === id);
      if (idx !== -1) state.documents.splice(idx, 1);
    }

    return {
      user, activeFolder, folderDocs, folderCount, currentFolder,
      FOLDERS, FILE_ICONS, showUpload, newDoc,
      openFolder, closeFolder, addDoc, removeDoc, canManage: window.canManage,
    };
  },

  template: `
    <div>
      <template v-if="!activeFolder">
        <h1 class="page-title">Документы</h1>
        <div v-for="f in FOLDERS" :key="f.key"
             class="doc-folder" @click="openFolder(f.key)"
             :style="{ background: f.color }">
          <span class="doc-folder-icon">{{ f.icon }}</span>
          <div>
            <div class="doc-folder-name">{{ f.label }}</div>
            <div class="doc-folder-count">{{ folderCount(f.key) }} файлов</div>
          </div>
          <span style="margin-left:auto; color:#8a9aba; font-size:20px;">›</span>
        </div>
      </template>

      <template v-else>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <button @click="closeFolder"
                  style="background:none; border:none; font-size:22px; cursor:pointer; color:#08205e; padding:0;">‹</button>
          <h1 class="page-title" style="margin:0; font-size:17px;">{{ currentFolder?.label }}</h1>
          <button v-if="canManage(user)" class="btn btn-primary btn-sm" style="margin-left:auto;" @click="showUpload=true">
            + Добавить
          </button>
        </div>

        <div v-if="folderDocs.length===0" class="empty-state">
          <span class="empty-icon">📂</span>
          <span class="empty-text">Документов нет</span>
        </div>

        <div v-for="doc in folderDocs" :key="doc.id" class="doc-file">
          <span class="doc-file-icon">{{ FILE_ICONS[doc.type] || '📄' }}</span>
          <div style="flex:1; min-width:0;">
            <div class="doc-file-name">{{ doc.name }}</div>
            <div class="doc-file-meta">{{ doc.type.toUpperCase() }} · {{ doc.size }} · {{ doc.date }}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <button class="btn btn-outline btn-sm">⬇ Скачать</button>
            <button v-if="canManage(user)"
                    style="background:none; border:none; color:#c0c8d8; font-size:16px; cursor:pointer;"
                    @click.stop="removeDoc(doc.id)">✕</button>
          </div>
        </div>
      </template>

      <div v-if="showUpload" class="modal-overlay" @click.self="showUpload=false">
        <div class="modal-sheet">
          <div class="modal-header">
            <h2 class="modal-title">Добавить документ</h2>
            <button class="modal-close" @click="showUpload=false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Название документа *</label>
            <input class="form-control" v-model="newDoc.name" placeholder="Должностная инструкция...">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Формат</label>
              <select class="form-control" v-model="newDoc.type">
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="xlsx">XLSX</option>
                <option value="pptx">PPTX</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Раздел</label>
              <select class="form-control" v-model="newDoc.folder">
                <option v-for="f in FOLDERS" :key="f.key" :value="f.key">{{ f.label }}</option>
              </select>
            </div>
          </div>
          <p style="font-size:12px; color:#8a9aba; margin-bottom:16px;">
            В демо-версии файлы добавляются в список. Загрузка реальных файлов будет доступна после подключения облачного хранилища.
          </p>
          <button class="btn btn-primary btn-block" @click="addDoc">Добавить в список</button>
        </div>
      </div>
    </div>
  `,
});
