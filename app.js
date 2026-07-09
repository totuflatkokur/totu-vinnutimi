const $ = id => document.getElementById(id);

let employees = [];
let entries = [];
let loggedEmployee = null;

function toast(msg){
  $("toast").textContent = msg;
  $("toast").classList.remove("hidden");
  setTimeout(() => $("toast").classList.add("hidden"), 2200);
}

function today(){
  return new Date().toISOString().slice(0,10);
}

function fmt(v){
  if(!v) return "";
  return new Date(v).toLocaleString("is-IS", {
    day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}

function hoursBetween(start, end){
  if(!start || !end) return 0;
  return Math.max(0, (new Date(end) - new Date(start)) / 1000 / 60 / 60);
}

function csvEscape(v){
  return `"${String(v ?? "").replaceAll('"','""')}"`;
}

function downloadCSV(filename, header, rows){
  const blob = new Blob(["\ufeff" + header.join(";") + "\n" + rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

async function sha256(text){
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function checkPin(emp, pin){
  if(emp.pin_hash) return await sha256(pin) === emp.pin_hash;
  return String(emp.pin_code || "") === String(pin);
}

async function hashPin(pin){
  return await sha256(String(pin));
}

function setupMonthYear(){
  const now = new Date();
  $("monthSelect").innerHTML = Array.from({length:12}, (_,i)=>`
    <option value="${i+1}" ${i===now.getMonth()?"selected":""}>${i+1}</option>
  `).join("");

  $("yearSelect").innerHTML = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1]
    .map(y => `<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`)
    .join("");
}

function bind(){
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.onclick = () => showPage(btn.dataset.page, btn);
  });

  $("loginBtn").onclick = employeeLogin;
  $("logoutBtn").onclick = employeeLogout;
  $("clockInBtn").onclick = clockIn;
  $("clockOutBtn").onclick = clockOut;

  $("adminLoginBtn").onclick = adminLogin;
  $("addEmployeeBtn").onclick = addEmployee;
  $("refreshBtn").onclick = refreshAll;
  $("payrollCsvBtn").onclick = payrollCSV;
  $("backupBtn").onclick = backup;

  $("monthSelect").onchange = renderAdmin;
  $("yearSelect").onchange = renderAdmin;
}

function showPage(page, btn){
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(`page-${page}`).classList.remove("hidden");
  document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
}

async function init(){
  setupMonthYear();
  bind();
  await refreshAll();
}

async function refreshAll(){
  await loadEmployees();
  await loadEntries();
  renderAll();
}

async function loadEmployees(){
  const { data, error } = await db.from("employees").select("*").order("name");
  if(error){
    console.error(error);
    toast("Næ ekki að sækja starfsmenn");
    employees = [];
    return;
  }
  employees = (data || []).filter(e => e.active !== false);
}

async function loadEntries(){
  const { data, error } = await db.from("time_entries").select("*").order("clock_in", {ascending:false});
  if(error){
    console.error(error);
    toast("Næ ekki að sækja tímaskráningar");
    entries = [];
    return;
  }
  entries = data || [];
}

function renderAll(){
  renderClock();
  renderWorkingNow();
  renderAdmin();
}

function renderClock(){
  $("employeeSelect").innerHTML = employees.length
    ? employees.map(e => `<option value="${e.id}">${e.name}</option>`).join("")
    : `<option>Engir starfsmenn fundust</option>`;
}

function currentOpenEntry(employeeId){
  return entries.find(e => e.employee_id === employeeId && !e.clock_out);
}

function renderWorkingNow(){
  const open = entries.filter(e => !e.clock_out);
  $("workingNowList").innerHTML = open.length
    ? open.map(e => `<div class="item"><b>${e.employee_name || "Starfsmaður"}</b><span class="pill ok">${fmt(e.clock_in)}</span></div>`).join("")
    : `<span class="pill">Enginn er skráður inni</span>`;
}

async function employeeLogin(){
  const emp = employees.find(e => e.id === $("employeeSelect").value);
  const pin = $("pinInput").value.trim();

  if(!emp) return toast("Veldu starfsmann");
  if(!pin) return toast("Sláðu inn PIN");
  if(!await checkPin(emp, pin)) return toast("Rangt PIN");

  loggedEmployee = emp;
  $("employeeName").textContent = emp.name;
  $("employeePanel").classList.remove("hidden");
  $("pinInput").value = "";

  renderEmployeeStatus();
  toast("Innskráning tókst");
}

function employeeLogout(){
  loggedEmployee = null;
  $("employeePanel").classList.add("hidden");
}

function renderEmployeeStatus(){
  if(!loggedEmployee) return;
  const open = currentOpenEntry(loggedEmployee.id);
  $("currentStatus").innerHTML = open
    ? `<b>Staða:</b> Í vinnu<br><span class="muted">Mætt: ${fmt(open.clock_in)}</span>`
    : `<b>Staða:</b> Ekki í vinnu`;
}

async function clockIn(){
  if(!loggedEmployee) return toast("Skráðu þig inn fyrst");

  const open = currentOpenEntry(loggedEmployee.id);
  if(open) return toast("Þú ert nú þegar skráð/ur inn");

  const { error } = await db.from("time_entries").insert({
    employee_id: loggedEmployee.id,
    employee_name: loggedEmployee.name,
    clock_in: new Date().toISOString()
  });

  if(error){
    console.error(error);
    return toast("Villa við mætingu");
  }

  toast("Mæting skráð");
  await refreshAll();
  renderEmployeeStatus();
}

async function clockOut(){
  if(!loggedEmployee) return toast("Skráðu þig inn fyrst");

  const open = currentOpenEntry(loggedEmployee.id);
  if(!open) return toast("Þú ert ekki skráð/ur inn");

  const out = new Date();
  const totalMinutes = Math.round((out - new Date(open.clock_in)) / 60000);

  const { error } = await db.from("time_entries").update({
    clock_out: out.toISOString(),
    total_minutes: totalMinutes,
    paid_minutes: totalMinutes
  }).eq("id", open.id);

  if(error){
    console.error(error);
    return toast("Villa við heimferð");
  }

  toast("Heimferð skráð");
  await refreshAll();
  renderEmployeeStatus();
}

function adminLogin(){
  if($("adminPassword").value !== ADMIN_PASSWORD) return toast("Rangt lykilorð");
  $("adminLogin").classList.add("hidden");
  $("adminPanel").classList.remove("hidden");
  renderAdmin();
  toast("Stjórnandi skráður inn");
}

async function addEmployee(){
  const name = $("newEmployeeName").value.trim();
  const pin = $("newEmployeePin").value.trim();

  if(!name) return toast("Vantar nafn");
  if(!pin) return toast("Vantar PIN");

  const pin_hash = await hashPin(pin);

  const { error } = await db.from("employees").insert({
    name,
    pin_hash,
    active: true
  });

  if(error){
    console.error(error);
    return toast("Villa við að bæta starfsmanni");
  }

  $("newEmployeeName").value = "";
  $("newEmployeePin").value = "";

  toast("Starfsmanni bætt við");
  await refreshAll();
}

function selectedMonthEntries(){
  const m = Number($("monthSelect").value);
  const y = Number($("yearSelect").value);

  return entries.filter(e => {
    if(!e.clock_in || !e.clock_out) return false;
    const d = new Date(e.clock_in);
    return d.getMonth()+1 === m && d.getFullYear() === y;
  });
}

function monthlySummary(){
  const monthEntries = selectedMonthEntries();
  return employees.map(emp => {
    const empEntries = monthEntries.filter(e => e.employee_id === emp.id);
    const totalHours = empEntries.reduce((sum,e)=>sum + hoursBetween(e.clock_in, e.clock_out),0);
    const last = entries.find(e => e.employee_id === emp.id);
    return {
      id: emp.id,
      name: emp.name,
      shifts: empEntries.length,
      totalHours,
      lastShift: last?.clock_in || null,
      workingNow: !!currentOpenEntry(emp.id)
    };
  });
}

function renderAdmin(){
  const summary = monthlySummary();
  const working = employees.filter(e => currentOpenEntry(e.id)).length;
  const totalHours = summary.reduce((s,r)=>s+r.totalHours,0);

  $("statEmployees").textContent = employees.length;
  $("statWorking").textContent = working;
  $("statMonthHours").textContent = totalHours.toFixed(2);

  $("employeesList").innerHTML = employees.length
    ? employees.map(e => `
      <div class="item">
        <div>
          <b>${e.name}</b><br>
          <span class="muted">PIN: ${e.pin_hash ? "hashað" : (e.pin_code ? "gamalt PIN" : "vantar")}</span>
        </div>
        <span class="pill ${currentOpenEntry(e.id) ? "ok" : ""}">${currentOpenEntry(e.id) ? "Í vinnu" : "Ekki í vinnu"}</span>
      </div>
    `).join("")
    : `<span class="pill">Engir starfsmenn</span>`;

  $("monthlyList").innerHTML = summary.length
    ? summary.map(r => `
      <div class="item">
        <div>
          <b>${r.name}</b><br>
          <span class="muted">${r.shifts} vaktir · síðast: ${r.lastShift ? fmt(r.lastShift) : "-"}</span>
        </div>
        <div>
          <span class="pill ok">${r.totalHours.toFixed(2)} klst</span>
          ${r.workingNow ? `<span class="pill bad">Í vinnu núna</span>` : ""}
        </div>
      </div>
    `).join("")
    : `<span class="pill">Engar skráningar</span>`;
}

function payrollCSV(){
  const summary = monthlySummary();
  const header = ["Starfsmaður","Vaktir","Klst samtals"];
  const rows = summary.map(r => [r.name, r.shifts, r.totalHours.toFixed(2)].map(csvEscape).join(";"));
  downloadCSV("totu-stimpilklukka-laun.csv", header, rows);
}

async function backup(){
  const data = {
    employees,
    time_entries: entries,
    exported_at: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "totu-stimpilklukka-backup.json";
  a.click();
}

init();
