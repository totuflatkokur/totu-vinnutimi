const SUPABASE_URL = "https://rzvcprkdriiywupaqupv.supabase.co";
const SUPABASE_ANON_KEY = "PUBLISHABLE_LYKILLINN_ÞINN";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PASSWORD = "1234";
db.from("employees").select("*").then(({ data, error }) => {
  alert(error ? "Supabase villa: " + error.message : "Starfsmenn fundust: " + data.length);
});
