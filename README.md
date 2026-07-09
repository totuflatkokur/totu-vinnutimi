# TótuOS Enterprise v4.0

Þetta er hreinn pakki fyrir Netlify/GitHub verkefnið.

## Skrár
- index.html
- style.css
- app.js
- supabase.js
- supabase_v4.sql

## Mikilvægt
Ef gamla `supabase.js` hjá þér virkar, haltu henni frekar.
Ef þú notar þessa nýju `supabase.js`, settu inn rétt:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- ADMIN_PASSWORD

## Uppsetning
1. Keyrðu `supabase_v4.sql` í Supabase SQL Editor.
2. Settu `index.html`, `style.css` og `app.js` yfir gömlu skrárnar í GitHub.
3. Ekki eyða gamla `supabase.js` nema þú ætlir að setja Supabase URL og key inn aftur.
4. Commit changes.
5. Netlify deploy-ar sjálfkrafa.
