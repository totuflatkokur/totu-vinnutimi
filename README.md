# TótuOS Enterprise v7.0 Admin Pack

Þessi pakki er hugsaður eins og uppfærslupakkarnir sem við höfum verið að gera.

## Innihald
- `supabase_v7_admin.sql` — SQL fyrir yfirlit, audit log og view
- `AdminDashboard.tsx` — Stjórnandi síða með mánaðaryfirliti, live status og CSV export
- `supabaseClient.ts` — dæmi um Supabase client ef vantar
- `install_notes.md` — stuttar leiðbeiningar

## Setja inn
1. Keyrðu `supabase_v7_admin.sql` í Supabase SQL Editor.
2. Settu `AdminDashboard.tsx` inn í `src/pages` eða þar sem admin síðan þín er.
3. Tengdu route/takka í appinu við AdminDashboard.
4. Ef Supabase client er nú þegar til, notaðu þinn núverandi client.
