/* Push-уведомления через Web Push + VAPID */
(function () {
  const VAPID_PUBLIC = 'BOoV_-Q5MwsHNFuGAFRH8KdFLJzacZC2TKOXudGR5TDPxRNN9cbkvB6k1A1dlH1KjpsJBvFnvtGcXUj2TpM7abI';

  function urlB64ToUint8(b64) {
    const pad  = '='.repeat((4 - b64.length % 4) % 4);
    const data = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(data, c => c.charCodeAt(0));
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.register('/bargut-tasks/sw.js', {
        scope: '/bargut-tasks/'
      });
    } catch (e) {
      console.warn('SW register failed:', e);
      return null;
    }
  }

  async function subscribePush(userId) {
    if (!('PushManager' in window)) return;

    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(VAPID_PUBLIC),
      });
    }

    const j = sub.toJSON();
    const { error } = await window.supabaseClient
      .from('push_subscriptions')
      .upsert({
        user_id:  userId,
        endpoint: j.endpoint,
        p256dh:   j.keys.p256dh,
        auth:     j.keys.auth,
      }, { onConflict: 'user_id' });

    if (error) console.warn('Push sub save error:', error.message);
    else console.log('Push подписка сохранена для user', userId);
  }

  window.PushMgr = { registerSW, subscribePush };
})();
