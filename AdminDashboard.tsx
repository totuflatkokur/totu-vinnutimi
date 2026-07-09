import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type MonthlyRow = {
  employee_id: string;
  employee_name: string;
  month: string | null;
  shift_count: number;
  total_hours: number;
  last_shift: string | null;
  is_working_now: boolean;
};

type ShiftRow = {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
};

function hoursBetween(start: string, end: string | null) {
  if (!end) return 0;
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60 / 60);
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<MonthlyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  async function loadMonthly() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("monthly_employee_hours")
      .select("*")
      .eq("month", monthStart)
      .order("employee_name", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  async function loadShifts(employee: MonthlyRow) {
    setSelectedEmployee(employee);

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, employee_id, clock_in, clock_out")
      .eq("employee_id", employee.employee_id)
      .gte("clock_in", monthStart)
      .lt("clock_in", monthEnd)
      .order("clock_in", { ascending: false });

    if (error) {
      setError(error.message);
      setShifts([]);
    } else {
      setShifts(data || []);
    }
  }

  useEffect(() => {
    loadMonthly();
  }, [month, year]);

  const filteredRows = useMemo(() => {
    return rows.filter(r =>
      r.employee_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const totalHours = filteredRows.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
    const workingNow = filteredRows.filter(r => r.is_working_now).length;
    const shifts = filteredRows.reduce((sum, r) => sum + Number(r.shift_count || 0), 0);
    return { totalHours, workingNow, shifts };
  }, [filteredRows]);

  return (
    <div style={{ minHeight: "100vh", background: "#071a33", color: "white", padding: 20 }}>
      <h1>Stjórnandi</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <button>💾 Sækja backup</button>
        <button>💰 Launa CSV</button>
        <button onClick={() => downloadCsv("manadaryfirlit.csv", filteredRows as any)}>📊 Sækja mánaðaryfirlit CSV</button>
      </div>

      <section style={{ background: "#0d294d", padding: 16, borderRadius: 16 }}>
        <h2>📊 Mánaðaryfirlit starfsmanna</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          />

          <input
            placeholder="Leita að starfsmanni"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#123967", padding: 12, borderRadius: 12 }}>Tímar samtals<br /><b>{totals.totalHours.toFixed(2)}</b></div>
          <div style={{ background: "#123967", padding: 12, borderRadius: 12 }}>Vaktir<br /><b>{totals.shifts}</b></div>
          <div style={{ background: "#123967", padding: 12, borderRadius: 12 }}>Í vinnu núna<br /><b>{totals.workingNow}</b></div>
        </div>

        {loading && <p>Sæki gögn...</p>}
        {error && <p style={{ color: "#ffb4b4" }}>Villa: {error}</p>}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Nafn</th>
                <th>Tímar</th>
                <th>Vaktir</th>
                <th>Síðasta vakt</th>
                <th>Staða</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.employee_id} onClick={() => loadShifts(row)} style={{ cursor: "pointer", borderTop: "1px solid #31557d" }}>
                  <td>{row.employee_name}</td>
                  <td>{Number(row.total_hours || 0).toFixed(2)}</td>
                  <td>{row.shift_count}</td>
                  <td>{row.last_shift ? new Date(row.last_shift).toLocaleDateString("is-IS") : "-"}</td>
                  <td>{row.is_working_now ? "Í vinnu núna" : "Ekki í vinnu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEmployee && (
        <section style={{ background: "#0d294d", padding: 16, borderRadius: 16, marginTop: 20 }}>
          <h2>Vaktir: {selectedEmployee.employee_name}</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Dagur</th>
                  <th>Inn</th>
                  <th>Út</th>
                  <th>Tímar</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(shift => (
                  <tr key={shift.id} style={{ borderTop: "1px solid #31557d" }}>
                    <td>{new Date(shift.clock_in).toLocaleDateString("is-IS")}</td>
                    <td>{new Date(shift.clock_in).toLocaleTimeString("is-IS")}</td>
                    <td>{shift.clock_out ? new Date(shift.clock_out).toLocaleTimeString("is-IS") : "Í vinnu núna"}</td>
                    <td>{hoursBetween(shift.clock_in, shift.clock_out).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
