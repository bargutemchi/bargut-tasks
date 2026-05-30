/* Онлайн-статус сотрудников через Supabase Presence */
(function () {
  let presenceChannel = null;
  const onlineUsers = new Set();
  const listeners   = [];

  function notify() { listeners.forEach(fn => fn(new Set(onlineUsers))); }

  function onChange(fn) { listeners.push(fn); }

  async function startPresence(userId) {
    const db = window.supabaseClient;
    presenceChannel = db.channel('online-users', {
      config: { presence: { key: String(userId) } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        onlineUsers.clear();
        const state = presenceChannel.presenceState();
        Object.values(state).flat().forEach(p => {
          if (p.user_id) onlineUsers.add(Number(p.user_id));
        });
        notify();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach(p => { if (p.user_id) onlineUsers.add(Number(p.user_id)); });
        notify();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => { if (p.user_id) onlineUsers.delete(Number(p.user_id)); });
        notify();
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: userId });
        }
      });
  }

  async function stopPresence() {
    if (presenceChannel) {
      await presenceChannel.untrack();
      window.supabaseClient.removeChannel(presenceChannel);
      presenceChannel = null;
      onlineUsers.clear();
      notify();
    }
  }

  function isOnline(userId) { return onlineUsers.has(Number(userId)); }

  window.Presence = { startPresence, stopPresence, isOnline, onChange, onlineUsers };
})();
