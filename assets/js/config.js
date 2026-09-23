/* ------------------------------------------------------------------
   Supabase connection.
   The anon key is meant to be public — security comes from the RLS
   policies on the table, not from hiding this string.
   ------------------------------------------------------------------ */

const SUPABASE_URL = 'https://tspcqcogplwbgympubnn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcGNxY29ncGx3Ymd5bXB1Ym5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NTc1NDMsImV4cCI6MjEwNTQzMzU0M30.kai63QTCbk27thBBrjj7F9uH9UaGhPBkc7xYgEi512g';

const TABLE_NAME = 'shapes';

// Address encoded in the "share this page" QR code. Leave empty to use
// whatever URL the page is currently served from; set it (e.g.
// 'https://tomasbombadillo.github.io/') if you want the QR to always point
// at the public site, even while testing on localhost.
const SITE_URL = '';

// `supabase` is the UMD global from the CDN script tag in index.html.
// Guarded so a blocked CDN degrades to "saving is off" instead of a blank page.
const supabaseClient =
  (typeof supabase !== 'undefined' && supabase.createClient)
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/* Translates Postgres / PostgREST error codes into something actionable.
   These three account for nearly every "it silently doesn't save" report.
   Messages come from the active language (see locales/*.js). */
function explainSupabaseError(err) {
  if (!err) return t('err.unknown');
  const code = err.code || '';
  const msg = err.message || '';

  if (code === '42501' || /row-level security/i.test(msg)) {
    return t('err.rls');
  }
  if (code === '42P01' || code === 'PGRST205' || /does not exist/i.test(msg)) {
    return t('err.noTable', { table: TABLE_NAME });
  }
  if (code === 'PGRST204' || /column/i.test(msg)) {
    return t('err.column');
  }
  if (code === '22P02') {
    return t('err.uuid');
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return t('err.network');
  }
  return msg || t('err.unknown');
}
