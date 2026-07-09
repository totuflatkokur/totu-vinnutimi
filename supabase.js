// Settu þín Supabase gildi hér ef þau eru ekki nú þegar í skránni þinni.
// Ef gamla supabase.js virkar nú þegar, þá má halda henni og ekki nota þessa.

const SUPABASE_URL = window.SUPABASE_URL || "SETTU_SUPABASE_URL_HER";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "SETTU_SUPABASE_ANON_KEY_HER";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stjórnanda lykilorð. Breyttu þessu.
const ADMIN_PASSWORD = window.ADMIN_PASSWORD || "1234";
