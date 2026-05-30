/* global Vue, VueRouter, APP_STATE, APP_USERS */
(function () {
const { defineComponent, ref } = Vue;
const { useRouter } = VueRouter;

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

window.LoginView = defineComponent({
  name: 'Login',
  setup() {
    const router  = useRouter();
    const state   = window.APP_STATE;
    const USERS   = window.APP_USERS;
    const db      = window.supabaseClient;

    const login    = ref('');
    const password = ref('');
    const error    = ref('');
    const loading  = ref(false);

    async function submit() {
      error.value   = '';
      const l = login.value.trim().toLowerCase();
      const p = password.value;
      if (!l || !p) { error.value = 'Введите логин и пароль'; return; }

      loading.value = true;
      try {
        const hash = await sha256hex(p);
        const { data, error: rpcErr } = await db.rpc('authenticate_staff', {
          p_login: l,
          p_hash:  hash,
        });

        if (rpcErr) throw rpcErr;
        if (!data) { error.value = 'Неверный логин или пароль'; return; }

        const user = USERS.find(u => u.id === data);
        if (!user) { error.value = 'Пользователь не найден'; return; }

        state.currentUser = user;
        router.push('/dashboard');
      } catch (e) {
        error.value = 'Ошибка входа: ' + (e.message || e);
      } finally {
        loading.value = false;
      }
    }

    function onKey(e) {
      if (e.key === 'Enter') submit();
    }

    return { login, password, error, loading, submit, onKey };
  },

  template: `
    <div class="login-screen">
      <div class="login-logo">
        <span class="logo-mark">🏥</span>
        <span class="brand-name">БАРГУТ ЭМЧИ</span>
        <span class="brand-sub">Восточная медицина · Персонал</span>
      </div>

      <div class="login-card">
        <h2>Вход в систему</h2>

        <div class="form-group">
          <label class="form-label" style="color:rgba(247,216,148,.7);">Логин</label>
          <input class="form-control"
                 v-model="login"
                 placeholder="Ваш логин"
                 autocomplete="username"
                 @keydown="onKey"
                 style="background:rgba(255,255,255,.08); border-color:rgba(247,216,148,.2); color:#fff; font-size:15px;">
        </div>

        <div class="form-group">
          <label class="form-label" style="color:rgba(247,216,148,.7);">Пароль</label>
          <input class="form-control"
                 type="password"
                 v-model="password"
                 placeholder="Ваш пароль"
                 autocomplete="current-password"
                 @keydown="onKey"
                 style="background:rgba(255,255,255,.08); border-color:rgba(247,216,148,.2); color:#fff; font-size:15px;">
        </div>

        <div v-if="error"
             style="color:#fc8181; font-size:13px; margin-bottom:12px; text-align:center;">
          {{ error }}
        </div>

        <button class="btn btn-gold btn-block"
                style="font-size:15px; height:48px; margin-top:4px;"
                :disabled="loading"
                @click="submit">
          {{ loading ? 'Вход...' : 'Войти' }}
        </button>
      </div>

      <p style="color:rgba(247,216,148,.4); font-size:11px; margin-top:20px; text-align:center;">
        Баргут Эмчи · Улан-Удэ, ул. Боевая 9а
      </p>
    </div>
  `,
});
})();
