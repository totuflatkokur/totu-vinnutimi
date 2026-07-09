const $ = (id) => document.getElementById(id);

let employees = [];
let entries = [];
let openEntries = [];
let loggedEmployee = null;

let settings = {
  first_coffee_minutes: 15,
  second_coffee_minutes: 15,
  lunch_minutes: 30,
  overtime_after_hours_day: 8,
};

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  setTimeout(() => $("toast").classList.add("hidden"), 2300);
}

function minsText(minutes) {
  minutes = Number(minutes || 0);
  return `${Math.floor(minutes / 60)} klst ${String(minutes % 60).padStart(2, "0")} mín`;
}

function fmtDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("is-IS", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function localISO(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function skippedBreakMinutes(firstCoffeeTaken, secondCoffeeTaken, lunchTaken) {
  return (!firstCoffeeTaken ? Number(settings.first_coffee_minutes || 0) : 0)
    + (!secondCoffeeTaken ? Number(settings.second_coffee_minutes || 0) : 0)
    + (!lunchTaken ? Number(settings.lunch_minutes || 0) : 0);
}

function paidMinutes(baseMinutes, firstCoffeeTaken, secondCoffeeTaken, lunchTaken) {
  return Math.max(0, Number(baseMinutes || 0) + skippedBreakMinutes(firstCoffeeTaken, secondCoffeeTaken, lunchTaken));
}

async function init() {
  $("monthPicker").value = new Date().toISOString().slice(0, 7);
  bindEvents();
  await loadSettings();
  await loadEmployees();
  await loadEntries();
  await loadOpenEntries();
}

function bindEvents() {
  $("adminToggle").onclick = () => $("adminSection").classList.toggle("hidden");
  $("adminLoginBtn").onclick = adminLogin;
  $("adminLogoutBtn").onclick = adminLogout;
  $("employeeLoginBtn").onclick = employeeLogin;
  $("employeeLogoutBtn").onclick = employeeLogout;
  $("clockInBtn").onclick = clockIn;
  $("clockOutShowBtn").onclick = showClockOut;
  $("clockOutBtn").onclick = clockOut;
  $("firstCoffee").onchange = previewPaid;
  $("secondCoffee").onchange = previewPaid;
  $("lunch").onchange = previewPaid;
  $("addEmployeeBtn").onclick = addEmployee;
  $("addManualBtn").onclick = addManualEntry;
  $("saveSettingsBtn").onclick = saveSettings;
  $("exportCsvBtn").onclick = downloadCSV;
  $("copyPayrollBtn").onclick = copyPayroll;
  $("backupBtn").onclick = backup;
  $("monthPicker").onchange = loadEntries;

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => setTab(btn.dataset.tab, btn);
  });
}

async function loadSettings() {
  const { data, error } = await db.from("app_settings").select("*");
  if (!error && data) {
    data.forEach(row => settings[row.key] = Number(row.value));
  }

  $("settingFirstCoffee").value = settings.first_coffee_minutes;
  $("settingSecondCoffee").value = settings.second_coffee_minutes;
  $("settingLunch").value = settings.lunch_minutes;
  $("settingOvertime").value = settings.overtime_after_hours_day;

  document.querySelectorAll("[data-setting]").forEach(el => {
    el.textContent = settings[el.dataset.setting];
  });
}

async function loadEmployees() {
  const { data, error } = await db.from("employees").select("*").order("name");
  if (error) {
    console.error(error);
    toast("Villa við að sækja starfsmenn");
    return;
  }

  employees = (data || []).filter(e => e.active !== false);

  const options = employees.map(e => `<option value="${e.id}">${e.name}</option>`).join("");
  $("employeeSelect").innerHTML = options;
  $("manualEmployee").innerHTML = options;

  $("employeesList").innerHTML = employees.map(e => `
    <div class="empCard">
      <div>
        <b>${e.name}</b><br>
        <span class="muted small">
          Kennitala: ${e.national_id || "-"} · Starfsnr: ${e.employee_no || "-"} ·
          PIN: ${e.pin_code ? "sett" : "vantar"} ·
          Tímakaup: ${Number(e.hourly_rate || 0).toLocaleString("is-IS")} kr
        </span>
      </div>
      <div class="row">
        <button class="secondary smallBtn" onclick="editEmployee('${e.id}')">Breyta</button>
        <button class="red smallBtn" onclick="hideEmployee('${e.id}')">Eyða</button>
      </div>
    </div>
  `).join("");
}

async function loadEntries() {
  const month = $("monthPicker").value || new Date().toISOString().slice(0, 7);
  $("monthPicker").value = month;

  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const { data, error } = await db
    .from("time_entries")
    .select("*")
    .gte("clock_in", start.toISOString())
    .lt("clock_in", end.toISOString())
    .order("clock_in", { ascending: false });

  if (error) {
    console.error(error);
    toast("Villa við að sækja tímaskráningar");
    return;
  }

  entries = data || [];
  renderEntries();
  renderSummary();
  renderDashboard();
  renderMyEntries();
}

async function loadOpenEntries() {
  const { data, error } = await db
    .from("time_entries")
    .select("*")
    .is("clock_out", null)
    .not("clock_in", "is", null)
    .order("clock_in", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  openEntries = data || [];
  renderOpenEntries();
  renderDashboard();
}

function renderOpenEntries() {
  $("openEntriesBox").innerHTML = openEntries.length
    ? openEntries.map(e => `<span class="pill ok">🟢 ${e.employee_name} · ${fmtDate(e.clock_in)}</span>`).join("")
    : `<span class="pill">Enginn skráður inni núna</span>`;
}

function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter(e => e.clock_in && new Date(e.clock_in).toISOString().slice(0, 10) === today);
  const paid = todayEntries.reduce((sum, e) => sum + Number(e.paid_minutes ?? e.total_minutes ?? 0), 0);
  const skipped = todayEntries.reduce((sum, e) => sum + Number(e.skipped_break_minutes || 0), 0);

  $("dashboardStats").innerHTML = `
    <div class="stat"><span class="muted">Í vinnu núna</span><b>${openEntries.length}</b></div>
    <div class="stat"><span class="muted">Skráðir í dag</span><b>${todayEntries.length}</b></div>
    <div class="stat"><span class="muted">Greitt í dag</span><b>${minsText(paid)}</b></div>
    <div class="stat"><span class="muted">Sleppt hlé</span><b>${minsText(skipped)}</b></div>
  `;
}

function renderEntries() {
  $("entriesBody").innerHTML = entries.map(e => {
    const skipped = [
      e.first_coffee === false ? "Fyrra kaffi sleppt" : "",
      e.second_coffee === false ? "Seinna kaffi sleppt" : "",
      e.lunch === false ? "Matur sleppt" : "",
      e.absence_type || "",
    ].filter(Boolean).join(", ");

    const taken = [
      e.first_coffee ? "Fyrra kaffi tekið" : "",
      e.second_coffee ? "Seinna kaffi tekið" : "",
      e.lunch ? "Matur tekinn" : "",
    ].filter(Boolean).join(", ");

    return `
      <tr>
        <td>${e.employee_name || ""}</td>
        <td>${fmtDate(e.clock_in)}</td>
        <td>${fmtDate(e.clock_out)}</td>
        <td>${taken || "-"}<br><span class="${skipped ? "pill warn" : "muted small"}">${skipped || "Engu sleppt"}</span></td>
        <td>${minsText(e.total_minutes)}</td>
        <td><b>${minsText(e.paid_minutes ?? e.total_minutes)}</b><br><span class="muted small">+${minsText(e.skipped_break_minutes || 0)}</span></td>
        <td>${e.note || ""}</td>
        <td><button class="red smallBtn" onclick="deleteEntry('${e.id}')">Eyða</button></td>
      </tr>
    `;
  }).join("");
}

function renderSummary() {
  const summary = {};

  entries.forEach(e => {
    const name = e.employee_name || "Óþekkt";
    if (!summary[name]) {
      summary[name] = { real: 0, paid: 0, skipped: 0, overtime: 0, abs: 0, days: new Set(), sf: 0, ss: 0, sl: 0 };
    }

    const real = Number(e.total_minutes || 0);
    const paid = Number(e.paid_minutes ?? e.total_minutes ?? 0);
    summary[name].real += real;
    summary[name].paid += paid;
    summary[name].skipped += Number(e.skipped_break_minutes || 0);

    if (e.first_coffee === false) summary[name].sf++;
    if (e.second_coffee === false) summary[name].ss++;
    if (e.lunch === false) summary[name].sl++;
    if (e.absence_type) summary[name].abs++;
    if (e.clock_in) summary[name].days.add(new Date(e.clock_in).toISOString().slice(0, 10));

    const overtimeAfter = Number(settings.overtime_after_hours_day || 8) * 60;
    if (paid > overtimeAfter) summary[name].overtime += paid - overtimeAfter;
  });

  const rows = Object.entries(summary).sort().map(([name, s]) => {
    const emp = employees.find(e => e.name === name) || {};
    const wage = Math.round((Number(emp.hourly_rate || 0) * s.paid) / 60);

    return `
      <tr>
        <td>${name}</td>
        <td>${s.days.size}</td>
        <td>${minsText(s.real)}</td>
        <td><b>${minsText(s.paid)}</b></td>
        <td>${minsText(s.skipped)}</td>
        <td>${minsText(s.overtime)}</td>
        <td><b>${wage.toLocaleString("is-IS")} kr</b></td>
        <td>${s.sf}/${s.ss}/${s.sl}</td>
        <td>${s.abs}</td>
      </tr>
    `;
  }).join("");

  $("summary").innerHTML = `
    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Starfsmaður</th><th>Dagar</th><th>Rauntími</th><th>Greiddur tími</th>
            <th>Sleppt hlé</th><th>Yfirvinna</th><th>Áætluð laun</th><th>Sleppt F/S/M</th><th>Fjarvistir</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderMyEntries() {
  if (!loggedEmployee) {
    $("myEntries").innerHTML = "";
    return;
  }

  const mine = entries.filter(e => e.employee_id === loggedEmployee.id || e.employee_name === loggedEmployee.name).slice(0, 8);
  $("myEntries").innerHTML = mine.length
    ? mine.map(e => `<span class="pill">${fmtDate(e.clock_in)} · ${minsText(e.paid_minutes ?? e.total_minutes)}</span>`).join("")
    : `<span class="pill">Engar skráningar í þessum mánuði</span>`;
}

async function employeeLogin() {
  const emp = employees.find(e => e.id === $("employeeSelect").value);
  const pin = $("employeePin").value.trim();

  if (!emp) return toast("Veldu starfsmann");
  if (!emp.pin_code) return toast("PIN vantar hjá starfsmanni");
  if (String(emp.pin_code) !== String(pin)) return toast("Rangt PIN");

  loggedEmployee = emp;
  $("loggedEmployeeName").textContent = emp.name;
  $("employeeLogin").classList.add("hidden");
  $("employeePanel").classList.remove("hidden");
  $("employeePin").value = "";
  renderMyEntries();
  toast("Innskráning tókst");
}

function employeeLogout() {
  loggedEmployee = null;
  $("employeePanel").classList.add("hidden");
  $("clockOutBox").classList.add("hidden");
  $("employeeLogin").classList.remove("hidden");
  renderMyEntries();
}

function requireLoggedEmployee() {
  if (!loggedEmployee) {
    toast("Þú þarft að skrá þig inn með PIN");
    return null;
  }
  return loggedEmployee;
}

async function clockIn() {
  const emp = requireLoggedEmployee();
  if (!emp) return;

  const { data: open } = await db
    .from("time_entries")
    .select("*")
    .eq("employee_id", emp.id)
    .is("clock_out", null)
    .limit(1);

  if (open && open.length) return toast("Þú ert nú þegar mætt/ur");

  const { error } = await db.from("time_entries").insert({
    employee_id: emp.id,
    employee_name: emp.name,
    clock_in: new Date().toISOString(),
    note: "",
  });

  if (error) {
    console.error(error);
    return toast("Villa við mætingu");
  }

  toast("✅ Mæting skráð");
  await loadEntries();
  await loadOpenEntries();
  setTimeout(employeeLogout, 900);
}

async function showClockOut() {
  $("clockOutBox").classList.toggle("hidden");
  await previewPaid();
}

async function previewPaid() {
  const emp = requireLoggedEmployee();
  if (!emp) return;

  const { data } = await db
    .from("time_entries")
    .select("*")
    .eq("employee_id", emp.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);

  if (!data || !data.length) {
    $("paidPreview").textContent = "Engin opin mæting fannst.";
    return;
  }

  const entry = data[0];
  const base = Math.max(0, Math.round((new Date() - new Date(entry.clock_in)) / 60000));
  const fc = $("firstCoffee").checked;
  const sc = $("secondCoffee").checked;
  const lu = $("lunch").checked;
  const skipped = skippedBreakMinutes(fc, sc, lu);
  const paid = base + skipped;

  $("paidPreview").innerHTML = `
    Rauntími: <b>${minsText(base)}</b><br>
    Sleppt hlé bætist við: <b>+${minsText(skipped)}</b><br>
    Greiddur tími í dag: <b>${minsText(paid)}</b>
  `;
}

async function clockOut() {
  const emp = requireLoggedEmployee();
  if (!emp) return;

  const { data, error } = await db
    .from("time_entries")
    .select("*")
    .eq("employee_id", emp.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);

  if (error || !data || !data.length) return toast("Engin opin mæting fannst");

  const entry = data[0];
  const out = new Date();
  const base = Math.max(0, Math.round((out - new Date(entry.clock_in)) / 60000));
  const fc = $("firstCoffee").checked;
  const sc = $("secondCoffee").checked;
  const lu = $("lunch").checked;
  const skipped = skippedBreakMinutes(fc, sc, lu);
  const paid = base + skipped;

  const { error: updateError } = await db.from("time_entries").update({
    clock_out: out.toISOString(),
    total_minutes: base,
    paid_minutes: paid,
    skipped_break_minutes: skipped,
    first_coffee: fc,
    second_coffee: sc,
    lunch: lu,
    break_minutes: 0,
  }).eq("id", entry.id);

  if (updateError) {
    console.error(updateError);
    return toast("Villa við heimferð");
  }

  $("firstCoffee").checked = true;
  $("secondCoffee").checked = true;
  $("lunch").checked = true;
  $("clockOutBox").classList.add("hidden");

  toast("✅ Heimferð skráð");
  await loadEntries();
  await loadOpenEntries();
  setTimeout(employeeLogout, 900);
}

function adminLogin() {
  if ($("adminPassword").value !== ADMIN_PASSWORD) return toast("Rangt lykilorð");
  $("adminLogin").classList.add("hidden");
  $("adminPanel").classList.remove("hidden");
  toast("Stjórnandi skráður inn");
}

function adminLogout() {
  $("adminPanel").classList.add("hidden");
  $("adminLogin").classList.remove("hidden");
}

function setTab(name, button) {
  document.querySelectorAll(".tabPage").forEach(page => page.classList.add("hidden"));
  $(`tab-${name}`).classList.remove("hidden");

  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  button.classList.add("active");
}

async function addEmployee() {
  const name = $("newName").value.trim();
  if (!name) return toast("Vantar nafn");

  const row = {
    name,
    national_id: $("newNationalId").value.trim(),
    employee_no: $("newEmployeeNo").value.trim(),
    pin_code: $("newPin").value.trim() || "1234",
    hourly_rate: Number($("newHourlyRate").value || 0),
    active: true,
  };

  const { error } = await db.from("employees").insert(row);
  if (error) {
    console.error(error);
    return toast("Villa við að bæta við starfsmanni");
  }

  ["newName", "newNationalId", "newEmployeeNo", "newPin", "newHourlyRate"].forEach(id => $(id).value = "");
  toast("Starfsmaður bættur við");
  await loadEmployees();
}

async function editEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  const name = prompt("Nafn:", emp.name);
  if (!name) return;

  const national_id = prompt("Kennitala:", emp.national_id || "") ?? emp.national_id;
  const employee_no = prompt("Starfsnúmer:", emp.employee_no || "") ?? emp.employee_no;
  const pin_code = prompt("PIN:", emp.pin_code || "") ?? emp.pin_code;
  const hourly_rate = Number(prompt("Tímakaup:", emp.hourly_rate || 0) ?? emp.hourly_rate ?? 0);

  const { error } = await db.from("employees").update({
    name, national_id, employee_no, pin_code, hourly_rate,
  }).eq("id", id);

  if (error) {
    console.error(error);
    return toast("Villa við að breyta starfsmanni");
  }

  toast("Starfsmanni breytt");
  await loadEmployees();
  await loadEntries();
}

async function hideEmployee(id) {
  if (!confirm("Eyða starfsmanni af lista? Gamlar skráningar geymast.")) return;

  const { error } = await db.from("employees").update({ active: false }).eq("id", id);
  if (error) {
    console.error(error);
    return toast("Villa við að eyða/fela starfsmann");
  }

  toast("Starfsmaður falinn");
  await loadEmployees();
}

async function addManualEntry() {
  const emp = employees.find(e => e.id === $("manualEmployee").value);
  if (!emp) return toast("Veldu starfsmann");

  const date = $("manualDate").value;
  if (!date) return toast("Veldu dagsetningu");

  const type = $("manualType").value;
  const clockIn = localISO(date, $("manualIn").value);
  const clockOut = localISO(date, $("manualOut").value);

  let base = Math.max(0, Math.round((new Date(clockOut) - new Date(clockIn)) / 60000));
  const fc = $("manualFirstCoffee").checked;
  const sc = $("manualSecondCoffee").checked;
  const lu = $("manualLunch").checked;
  let skipped = skippedBreakMinutes(fc, sc, lu);
  let paid = base + skipped;

  if (type) {
    base = 0;
    skipped = 0;
    paid = 0;
  }

  const { error } = await db.from("time_entries").insert({
    employee_id: emp.id,
    employee_name: emp.name,
    clock_in: clockIn,
    clock_out: clockOut,
    total_minutes: base,
    paid_minutes: paid,
    skipped_break_minutes: skipped,
    first_coffee: fc,
    second_coffee: sc,
    lunch: lu,
    break_minutes: 0,
    manual: true,
    absence_type: type || null,
    note: $("manualNote").value || "Handvirk skráning",
  });

  if (error) {
    console.error(error);
    return toast("Villa við handvirka skráningu");
  }

  toast("Handvirk skráning vistuð");
  await loadEntries();
  await loadOpenEntries();
}

async function deleteEntry(id) {
  if (!confirm("Eyða þessari skráningu?")) return;

  const { error } = await db.from("time_entries").delete().eq("id", id);
  if (error) {
    console.error(error);
    return toast("Villa við að eyða skráningu");
  }

  toast("Skráningu eytt");
  await loadEntries();
  await loadOpenEntries();
}

async function saveSettings() {
  const rows = [
    ["first_coffee_minutes", $("settingFirstCoffee").value || 15],
    ["second_coffee_minutes", $("settingSecondCoffee").value || 15],
    ["lunch_minutes", $("settingLunch").value || 30],
    ["overtime_after_hours_day", $("settingOvertime").value || 8],
  ].map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));

  for (const row of rows) {
    await db.from("app_settings").upsert(row);
  }

  toast("Stillingar vistaðar");
  await loadSettings();
  await loadEntries();
}

function downloadCSV() {
  const header = [
    "Kennitala", "Starfsnúmer", "Starfsmaður", "Mætti", "Fór",
    "Raun mín", "Greiddar mín", "Greiddur tími", "Sleppt hlé mín",
    "Tímakaup", "Áætluð laun", "Fyrra kaffi tekið", "Seinna kaffi tekið",
    "Matur tekinn", "Athugasemd", "Fjarvist"
  ];

  const rows = entries.map(e => {
    const emp = employees.find(x => x.id === e.employee_id || x.name === e.employee_name) || {};
    const paid = Number(e.paid_minutes ?? e.total_minutes ?? 0);
    const wage = Math.round((Number(emp.hourly_rate || 0) * paid) / 60);

    return [
      emp.national_id, emp.employee_no, e.employee_name, fmtDate(e.clock_in), fmtDate(e.clock_out),
      e.total_minutes, paid, minsText(paid), e.skipped_break_minutes,
      emp.hourly_rate || 0, wage,
      e.first_coffee ? "Já" : "Nei",
      e.second_coffee ? "Já" : "Nei",
      e.lunch ? "Já" : "Nei",
      e.note, e.absence_type,
    ].map(csvEscape).join(";");
  });

  const blob = new Blob(["\ufeff" + header.join(";") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "totu-vinnutimi-pro-v20.csv";
  a.click();
}

function copyPayroll() {
  const lines = [...document.querySelectorAll("#summary tbody tr")].map(tr => {
    const cells = [...tr.children].map(td => td.textContent);
    return `${cells[0]} – greiddur tími ${cells[3]} – áætluð laun ${cells[6]} (sleppt hlé ${cells[4]}, yfirvinna ${cells[5]})`;
  });

  navigator.clipboard.writeText(lines.join("\n"));
  toast("Launalisti afritaður");
}

async function backup() {
  const [employeesData, entriesData, settingsData] = await Promise.all([
    db.from("employees").select("*"),
    db.from("time_entries").select("*"),
    db.from("app_settings").select("*"),
  ]);

  const data = {
    employees: employeesData.data,
    time_entries: entriesData.data,
    settings: settingsData.data,
    exported_at: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "totu-vinnutimi-backup.json";
  a.click();
}

init();
