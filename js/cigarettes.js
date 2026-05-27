// ---------------------------------------------------------------
// Helpers for the `cigarettes` table.
//
// Table schema (created in Supabase):
//   id         int8         PK (auto-increment)
//   created_at timestamptz  default now()
//   brand      text
//   quantity   int4         default 0
//
// Requires:
//   1) window.HAKS_CONFIG from js/config.js (your Supabase URL + anon key)
//   2) @supabase/supabase-js loaded before this script
//
// After this file loads, you can call these from anywhere in your
// page or directly from the browser DevTools console, e.g.:
//
//   await cigarettesAPI.fetchCigarettes()
//   await cigarettesAPI.addCigarette('Marlboro', 50)
// ---------------------------------------------------------------

(function () {
  const cfg = window.HAKS_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('PASTE') ||
      !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('PASTE')) {
    console.warn('[cigarettes.js] Supabase not configured. Paste keys into js/config.js.');
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[cigarettes.js] @supabase/supabase-js SDK not loaded.');
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // READ: return all rows, newest first.
  async function fetchCigarettes() {
    const { data, error } = await client
      .from('cigarettes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // WRITE: insert one row and return it.
  async function addCigarette(brand, quantity) {
    brand = (brand || '').trim();
    quantity = Number(quantity);
    if (!brand) throw new Error('brand is required');
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('quantity must be a non-negative number');
    }
    const { data, error } = await client
      .from('cigarettes')
      .insert({ brand, quantity })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  window.cigarettesAPI = { client, fetchCigarettes, addCigarette };
})();
