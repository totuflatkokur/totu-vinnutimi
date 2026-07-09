# Uppsetning

## 1. Supabase
Farðu í Supabase → SQL Editor og keyrðu:

`supabase_v7_admin.sql`

## 2. GitHub / kóði
Settu `AdminDashboard.tsx` inn í:
- `src/pages/AdminDashboard.tsx`
eða þar sem admin síðan þín er.

Ef þú ert með Supabase client nú þegar, lagaðu import línuna efst:
```ts
import { supabase } from "../lib/supabaseClient";
```

## 3. Route / takki
Tengdu stjórnanda takkann við þessa síðu.

## 4. Athugið
Þessi pakki gerir ráð fyrir töflum:
- employees
- time_entries

og dálkum:
- employees.id
- employees.name
- time_entries.id
- time_entries.employee_id
- time_entries.clock_in
- time_entries.clock_out

Ef töflurnar þínar heita öðru nafni þarf bara að laga SQL view-ið.
