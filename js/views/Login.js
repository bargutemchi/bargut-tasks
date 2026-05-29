/* global Vue, VueRouter, APP_STATE, APP_USERS */
(function () {
const { defineComponent } = Vue;
const { useRouter } = VueRouter;

window.LoginView = defineComponent({
  name: 'Login',
  setup() {
    const router = useRouter();
    const state  = window.APP_STATE;
    const USERS  = window.APP_USERS;

    function login(user) {
      state.currentUser = user;
      router.push('/dashboard');
    }

    return { USERS, login };
  },

  template: `
    <div class="login-screen">
      <div class="login-logo">
        <span class="logo-mark">🏥</span>
        <span class="brand-name">БАРГУТ ЭМЧИ</span>
        <span class="brand-sub">Восточная медицина · Персонал</span>
      </div>

      <div class="login-card">
        <h2>Выберите профиль</h2>

        <div v-for="user in USERS" :key="user.id"
             class="user-select-item"
             @click="login(user)">
          <div class="avatar" :style="{ background: user.color }">
            {{ user.short }}
          </div>
          <div>
            <div class="user-select-name">{{ user.name }}</div>
            <div class="user-select-role">{{ user.roleLabel }}</div>
          </div>
          <span style="margin-left:auto; color:rgba(247,216,148,.5); font-size:20px;">›</span>
        </div>
      </div>

      <p style="color:rgba(247,216,148,.4); font-size:11px; margin-top:20px; text-align:center;">
        Баргут Эмчи · Улан-Удэ, ул. Боевая 9а
      </p>
    </div>
  `,
});
})();
