/* ------------------------------------------------------------------
   Supabase connection.
   The anon key is meant to be public — security comes from the RLS
   policies on the table, not from hiding this string.
   ------------------------------------------------------------------ */

const SUPABASE_URL = 'https://tspcqcogplwbgympubnn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcGNxY29ncGx3Ymd5bXB1Ym5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NTc1NDMsImV4cCI6MjEwNTQzMzU0M30.kai63QTCbk27thBBrjj7F9uH9UaGhPBkc7xYgEi512g';

const TABLE_NAME = 'shapes';

// `supabase` is the UMD global from the CDN script tag in index.html.
// Guarded so a blocked CDN degrades to "saving is off" instead of a blank page.
const supabaseClient =
  (typeof supabase !== 'undefined' && supabase.createClient)
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/* Translates Postgres / PostgREST error codes into something actionable.
   These three account for nearly every "it silently doesn't save" report. */
function explainSupabaseError(err) {
  if (!err) return 'Unknown error.';
  const code = err.code || '';

  if (code === '42501' || /row-level security/i.test(err.message || '')) {
    return 'Blocked by Row Level Security. The table exists but anonymous users are not allowed to write to it — you need an INSERT policy.';
  }
  if (code === '42P01' || code === 'PGRST205' || /does not exist/i.test(err.message || '')) {
    return `Table "${TABLE_NAME}" was not found in your database. Create it with the SQL in the setup notes.`;
  }
  if (code === 'PGRST204' || /column/i.test(err.message || '')) {
    return 'A column in the table does not match what the app sends. Check that the table has display_name (text) and shape (jsonb).';
  }
  if (code === '22P02') {
    return 'That ID is not a valid UUID.';
  }
  if (/Failed to fetch|NetworkError/i.test(err.message || '')) {
    return 'Could not reach Supabase at all. Check the project URL, your internet connection, and whether the project is paused.';
  }
  return err.message || 'Unknown error.';
}