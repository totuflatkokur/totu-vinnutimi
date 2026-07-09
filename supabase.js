// TótuOS Enterprise v5 Supabase tenging
// Settu publishable key-inn þinn í SUPABASE_ANON_KEY.

const SUPABASE_URL = "https://rzvcprkdriiywupaqupv.supabase.co";
const SUPABASE_ANON_KEY = "SETTU_PUBLISHABLE_KEY_HER";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Breyttu þessu lykilorði ef þú vilt.
const ADMIN_PASSWORD = "1234";
