/* global supabase */
(function () {
  const SUPABASE_URL = 'https://borcyrnppmezvuddoywn.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_u5X6o4giDH54gh7wskgUyg_ir8aQS4t';
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
})();
