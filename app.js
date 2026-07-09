const $ = id => document.getElementById(id);

let employees=[], entries=[], customers=[], orders=[], production=[], tasks=[], inventory=[], loggedEmployee=null;
let monthlyRows=[], liveRows=[];
let settings={first_coffee_minutes:15,second_coffee_minutes:15,lunch_minutes:30,overtime_after_hours_day:8};

async function sha256(text){const data=new TextEncoder().encode(text);const hash=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function checkPin(emp,pin){if(emp.pin_hash)return await sha256(pin)===emp.pin_hash;return String(emp.pin_code||"")===String(pin)}
function toast(m){$("toast").textContent=m;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2400)}
function minsText(m){m=Number(m||0);return `${Math.floor(m/60)} klst ${String(Math.round(m%60)).padStart(2,"0")} mín`}
function fmt(v){if(!v)return "";return new Date(v).toLocaleString("is-IS",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function dateOnly(v){if(!v)return "-";return new Date(v).toLocaleDateString("is-IS")}
function today(){return new Date().toISOString().slice(0,10)}
function skipped(fc,sc,lu){return(!fc?settings.first_coffee_minutes:0)+(!sc?settings.second_coffee_minutes:0)+(!lu?settings.lunch_minutes:0)}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function downloadCSV(filename, header, rows){
  const blob=new Blob(["\ufeff"+header.join(";")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}

async function init(){
  ["orderDate","productionDate","taskDate"].forEach(id=>{if($(id))$(id).value=today()});
  setupAdminSelectors();
  bind();
  await loadAll();
  renderAll();
}

function bind(){
  document.querySelectorAll(".navBtn").forEach(b=>b.onclick=()=>showPage(b.dataset.page,b));
  $("adminBtn").onclick=()=>showPage("admin",document.querySelector('[data-page="admin"]'));
  $("employeeLoginBtn").onclick=employeeLogin;$("employeeLogoutBtn").onclick=employeeLogout;
  $("clockInBtn").onclick=clockIn;$("clockOutShowBtn").onclick=()=>{$("clockOutBox").classList.toggle("hidden");previewPaid()};
  $("clockOutBtn").onclick=clockOut;
  ["firstCoffee","secondCoffee","lunch"].forEach(id=>$(id).onchange=previewPaid);
  $("addCustomerBtn").onclick=addCustomer;$("addOrderBtn").onclick=addOrder;$("copyYesterdayBtn").onclick=copyYesterday;$("exportOrdersBtn").onclick=exportOrdersCSV;
  $("saveProductionTargetBtn").onclick=saveProductionTarget;$("addDoughBtn").onclick=()=>addProduction("dough_count",1);$("addBakedBtn").onclick=()=>addProduction("baked_packs",100);$("addPackedBtn").onclick=()=>addProduction("packed_packs",50);$("loadTruckBtn").onclick=()=>addProduction("loaded_trucks",1);
  $("addTaskBtn").onclick=addTask;$("addInventoryBtn").onclick=addInventory;
  $("adminLoginBtn").onclick=()=>{if($("adminPassword").value===ADMIN_PASSWORD){$("adminLogin").classList.add("hidden");$("adminPanel").classList.remove("hidden");toast("Stjórnandi skráður inn");loadAdminData()}else toast("Rangt lykilorð")};
  $("backupBtn").onclick=backup;$("payrollCsvBtn").onclick=payrollCSV;
  $("refreshMonthlyBtn").onclick=loadAdminData;$("monthlyCsvBtn").onclick=monthlyCSV;
  $("adminMonth").onchange=renderMonthly;$("adminYear").onchange=renderMonthly;$("adminSearch").oninput=renderMonthly;
}

function setupAdminSelectors(){
  const now=new Date();
  $("adminMonth").innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===now.getMonth()?"selected":""}>${i+1}</option>`).join("");
  $("adminYear").innerHTML=[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=>`<option value="${y}" ${y===now.getFullYear()?"selected":""}>${y}</option>`).join("");
}

function showPage(p,btn){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  $(`page-${p}`).classList.remove("hidden");
  document.querySelectorAll(".navBtn").forEach(x=>x.classList.remove("active"));
  if(btn)btn.classList.add("active");
}

async function loadAll(){
  await loadSettings(); await loadEmployees(); await loadEntries(); await loadCustomers(); await loadOrders(); await loadProduction(); await loadTasks(); await loadInventory();
}
async function loadSettings(){const{data}=await db.from("app_settings").select("*");(data||[]).forEach(r=>settings[r.key]=Number(r.value))}
async function loadEmployees(){const{data}=await db.from("employees").select("*").order("name");employees=(data||[]).filter(e=>e.active!==false);$("employeeSelect").innerHTML=employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join("");$("taskEmployee").innerHTML=`<option value="">Óúthlutað</option>`+employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join("")}
async function loadEntries(){const start=new Date(today()+"T00:00:00");const{data}=await db.from("time_entries").select("*").gte("clock_in",start.toISOString()).order("clock_in",{ascending:false});entries=data||[]}
async function loadCustomers(){const{data}=await db.from("customers").select("*").order("chain").order("name");customers=data||[];$("orderCustomer").innerHTML=customers.map(c=>`<option value="${c.id}">${c.chain||""} ${c.name}</option>`).join("")}
async function loadOrders(){const d=$("orderDate").value||today();const{data}=await db.from("orders").select("*, customers(*)").eq("order_date",d).order("created_at");orders=data||[]}
async function loadProduction(){const d=$("productionDate").value||today();const{data}=await db.from("production_days").select("*").eq("work_date",d).limit(1);production=data||[]}
async function loadTasks(){const d=$("taskDate").value||today();const{data}=await db.from("tasks").select("*, employees(*)").eq("task_date",d).order("created_at");tasks=data||[]}
async function loadInventory(){const{data}=await db.from("inventory_items").select("*").order("name");inventory=data||[]}
async function loadAdminData(){await loadMonthlyRows();await loadLiveRows();renderMonthly();renderLiveStatus()}

async function loadMonthlyRows(){
  const {data,error}=await db.from("monthly_employee_hours").select("*").order("employee_name");
  if(error){console.error(error);toast("Villa við mánaðaryfirlit");monthlyRows=[];return}
  monthlyRows=data||[];
}
async function loadLiveRows(){
  const {data,error}=await db.from("live_clock_status").select("*").order("employee_name");
  if(error){console.error(error);liveRows=[];return}
  liveRows=data||[];
}

function renderAll(){renderHome();renderTime();renderCustomers();renderOrders();renderProduction();renderTasks();renderInventory()}
function renderHome(){
 const open=entries.filter(e=>!e.clock_out); const paid=entries.reduce((a,e)=>a+Number(e.paid_minutes??e.total_minutes??0),0); const orderPacks=orders.reduce((a,o)=>a+Number(o.packs||0),0); const prod=production[0]||{}; const undone=tasks.filter(t=>!t.completed_at).length; const low=inventory.filter(i=>Number(i.quantity||0)<=Number(i.min_quantity||0)).length;
 $("homeStats").innerHTML=`<div class="stat"><span>Í vinnu</span><b>${open.length}</b></div><div class="stat"><span>Pantanir pakkar</span><b>${orderPacks}</b></div><div class="stat"><span>Greitt í dag</span><b>${minsText(paid)}</b></div><div class="stat"><span>Verk eftir</span><b>${undone}</b></div>`;
 $("openEntries").innerHTML=open.length?open.map(e=>`<span class="pill ok">🟢 ${e.employee_name} · ${fmt(e.clock_in)}</span>`).join(""):"<span class='pill'>Enginn skráður inni</span>";
 $("todayOrders").innerHTML=orders.length?orders.map(o=>`<div class="item"><b>${o.customers?.name||"Verslun"}</b><span>${o.packs||0} pakkar · ${o.items||0} stk</span></div>`).join(""):"<span class='pill'>Engar pantanir skráðar</span>";
 $("todayTasks").innerHTML=tasks.length?tasks.slice(0,8).map(t=>`<div class="item ${t.completed_at?'done':''}"><b>${t.title}</b><span>${t.completed_at?'Lokið':'Opið'}</span></div>`).join(""):"<span class='pill'>Engin verkefni</span>";
 $("inventoryWarnings").innerHTML=low?inventory.filter(i=>Number(i.quantity||0)<=Number(i.min_quantity||0)).map(i=>`<span class="pill bad">⚠️ ${i.name}: ${i.quantity} ${i.unit||''}</span>`).join(""):"<span class='pill ok'>Allt yfir lágmarki</span>";
 $("productionStatus").innerHTML=`<div class="statgrid"><div class="stat"><span>Markmið</span><b>${prod.target_packs||0}</b></div><div class="stat"><span>Deig</span><b>${prod.dough_count||0}</b></div><div class="stat"><span>Bakað</span><b>${prod.baked_packs||0}</b></div><div class="stat"><span>Pakkað</span><b>${prod.packed_packs||0}</b></div></div>`;
}
function renderTime(){const open=entries.filter(e=>!e.clock_out);const paid=entries.reduce((a,e)=>a+Number(e.paid_minutes??e.total_minutes??0),0);$("timeDashboard").innerHTML=`<div class="stat"><span>Í vinnu</span><b>${open.length}</b></div><div class="stat"><span>Skráningar</span><b>${entries.length}</b></div><div class="stat"><span>Greitt</span><b>${minsText(paid)}</b></div><div class="stat"><span>Starfsmenn</span><b>${employees.length}</b></div>`}
function renderCustomers(){$("customersList").innerHTML=customers.length?customers.map(c=>`<div class="item"><div><b>${c.name}</b><br><span class="muted small">${c.chain||"-"} · ${c.route||"-"}</span></div></div>`).join(""):"<span class='pill'>Engar verslanir skráðar</span>"}
function renderOrders(){const total=orders.reduce((a,o)=>a+Number(o.packs||0),0);$("ordersList").innerHTML=`<p class="pill ok">Samtals ${total} pakkar</p>`+(orders.map(o=>`<div class="item"><div><b>${o.customers?.name||"Verslun"}</b><br><span class="muted small">${o.customers?.chain||""}</span></div><div>${o.packs||0} pakkar · ${o.items||0} stk</div></div>`).join("")||"<span class='pill'>Engar pantanir</span>")}
function renderProduction(){const p=production[0]||{};$("productionTarget").value=p.target_packs||""}
function renderTasks(){$("tasksList").innerHTML=tasks.length?tasks.map(t=>`<div class="item ${t.completed_at?'done':''}"><div><b>${t.title}</b><br><span class="muted small">${t.employees?.name||"Óúthlutað"}</span></div><div>${t.completed_at?'<span class="pill ok">Lokið</span>':`<button class="green smallBtn" onclick="completeTask('${t.id}')">Klára</button>`}</div></div>`).join(""):"<span class='pill'>Engin verkefni</span>"}
function renderInventory(){$("inventoryList").innerHTML=inventory.length?inventory.map(i=>`<div class="item"><div><b>${i.name}</b><br><span class="muted small">Lágmark: ${i.min_quantity||0} ${i.unit||""}</span></div><div><span class="pill ${Number(i.quantity||0)<=Number(i.min_quantity||0)?'bad':'ok'}">${i.quantity||0} ${i.unit||""}</span><button class="secondary smallBtn" onclick="adjustInventory('${i.id}',1)">+1</button><button class="secondary smallBtn" onclick="adjustInventory('${i.id}',-1)">-1</button></div></div>`).join(""):"<span class='pill'>Enginn lager skráður</span>"}

function renderMonthly(){
  const box=$("monthlyList"), stats=$("monthlyStats"); if(!box||!stats)return;
  const m=Number($("adminMonth").value), y=Number($("adminYear").value), q=($("adminSearch").value||"").toLowerCase();
  const rows=monthlyRows.filter(r=>{
    if(!r.month) return false;
    const d=new Date(r.month);
    return d.getMonth()+1===m && d.getFullYear()===y && String(r.employee_name||"").toLowerCase().includes(q);
  });
  const total=rows.reduce((a,r)=>a+Number(r.total_hours||0),0);
  const shifts=rows.reduce((a,r)=>a+Number(r.shift_count||0),0);
  const working=rows.filter(r=>r.is_working_now).length;
  stats.innerHTML=`<div class="stat"><span>Tímar</span><b>${total.toFixed(2)}</b></div><div class="stat"><span>Vaktir</span><b>${shifts}</b></div><div class="stat"><span>Í vinnu</span><b>${working}</b></div><div class="stat"><span>Starfsmenn</span><b>${rows.length}</b></div>`;
  if(!rows.length){box.innerHTML="<span class='pill'>Engar tímaskráningar fundust fyrir valinn mánuð.</span>";return}
  box.innerHTML=rows.map(r=>`<div class="item"><div><b>${r.employee_name}</b><br><span class="muted small">${r.shift_count||0} vaktir · síðast: ${dateOnly(r.last_shift)}</span></div><div><span class="pill ok">${Number(r.total_hours||0).toFixed(2)} klst</span>${r.is_working_now?'<span class="pill bad">Í vinnu núna</span>':'<span class="pill">Ekki í vinnu</span>'}</div></div>`).join("");
}
function renderLiveStatus(){
  const box=$("liveStatusList"); if(!box)return;
  const rows=liveRows.filter(r=>r.is_working_now);
  box.innerHTML=rows.length?rows.map(r=>`<div class="item"><b>${r.employee_name}</b><span class="pill ok">${fmt(r.clock_in)}</span></div>`).join(""):"<span class='pill'>Enginn er skráður inni núna</span>";
}

async function employeeLogin(){const emp=employees.find(e=>e.id===$("employeeSelect").value);const pin=$("employeePin").value.trim();if(!emp)return toast("Veldu starfsmann");if(!await checkPin(emp,pin))return toast("Rangt PIN");loggedEmployee=emp;$("loggedEmployeeName").textContent=emp.name;$("employeeLogin").classList.add("hidden");$("employeePanel").classList.remove("hidden");$("employeePin").value="";toast("Innskráning tókst")}
function employeeLogout(){loggedEmployee=null;$("employeePanel").classList.add("hidden");$("clockOutBox").classList.add("hidden");$("employeeLogin").classList.remove("hidden")}
async function clockIn(){if(!loggedEmployee)return toast("Skráðu þig inn");const{data:open}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).limit(1);if(open?.length)return toast("Þú ert nú þegar mætt/ur");await db.from("time_entries").insert({employee_id:loggedEmployee.id,employee_name:loggedEmployee.name,clock_in:new Date().toISOString()});toast("Mæting skráð");await loadEntries();renderAll();setTimeout(employeeLogout,900)}
async function previewPaid(){if(!loggedEmployee)return;const{data}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).order("clock_in",{ascending:false}).limit(1);if(!data?.length){$("paidPreview").textContent="Engin opin mæting fannst";return}const base=Math.max(0,Math.round((new Date()-new Date(data[0].clock_in))/60000));const s=skipped($("firstCoffee").checked,$("secondCoffee").checked,$("lunch").checked);$("paidPreview").innerHTML=`Rauntími: <b>${minsText(base)}</b><br>Sleppt hlé: <b>+${minsText(s)}</b><br>Greiddur tími: <b>${minsText(base+s)}</b>`}
async function clockOut(){if(!loggedEmployee)return;const{data}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).order("clock_in",{ascending:false}).limit(1);if(!data?.length)return toast("Engin opin mæting");const e=data[0],out=new Date(),base=Math.max(0,Math.round((out-new Date(e.clock_in))/60000));const fc=$("firstCoffee").checked,sc=$("secondCoffee").checked,lu=$("lunch").checked,s=skipped(fc,sc,lu);await db.from("time_entries").update({clock_out:out.toISOString(),total_minutes:base,paid_minutes:base+s,skipped_break_minutes:s,first_coffee:fc,second_coffee:sc,lunch:lu}).eq("id",e.id);toast("Heimferð skráð");await loadEntries();renderAll();setTimeout(employeeLogout,900)}

async function addCustomer(){const name=$("customerName").value.trim();if(!name)return toast("Vantar nafn verslunar");await db.from("customers").insert({name,chain:$("customerChain").value.trim(),route:$("customerRoute").value.trim()});["customerName","customerChain","customerRoute"].forEach(id=>$(id).value="");toast("Verslun bætt við");await loadCustomers();renderCustomers()}
async function addOrder(){const customer_id=$("orderCustomer").value;if(!customer_id)return toast("Vantar verslun");await db.from("orders").insert({order_date:$("orderDate").value||today(),customer_id,packs:Number($("orderPacks").value||0),items:Number($("orderItems").value||0),status:"Skráð"});$("orderPacks").value="";$("orderItems").value="";toast("Pöntun skráð");await loadOrders();renderAll()}
async function copyYesterday(){const d=new Date($("orderDate").value||today());const y=new Date(d);y.setDate(y.getDate()-1);const ystr=y.toISOString().slice(0,10);const{data}=await db.from("orders").select("*").eq("order_date",ystr);if(!data?.length)return toast("Engar pantanir í gær");await db.from("orders").insert(data.map(o=>({order_date:$("orderDate").value||today(),customer_id:o.customer_id,packs:o.packs,items:o.items,status:"Afritað"})));toast("Gærdagurinn afritaður");await loadOrders();renderAll()}
function exportOrdersCSV(){const header=["Dagur","Keðja","Verslun","Pakkar","Stykki"];const rows=orders.map(o=>[o.order_date,o.customers?.chain,o.customers?.name,o.packs,o.items].map(csvEscape).join(";"));downloadCSV("totuos-pantanir.csv",header,rows)}

async function saveProductionTarget(){const d=$("productionDate").value||today();await db.from("production_days").upsert({work_date:d,target_packs:Number($("productionTarget").value||0)});toast("Markmið vistað");await loadProduction();renderAll()}
async function addProduction(field,amount){const d=$("productionDate").value||today();let p=production[0];if(!p){await db.from("production_days").insert({work_date:d,target_packs:Number($("productionTarget").value||0)});await loadProduction();p=production[0]}await db.from("production_days").update({[field]:Number(p[field]||0)+amount}).eq("id",p.id);await loadProduction();renderAll()}

async function addTask(){const title=$("taskTitle").value.trim();if(!title)return toast("Vantar verkefni");await db.from("tasks").insert({task_date:$("taskDate").value||today(),title,employee_id:$("taskEmployee").value||null});$("taskTitle").value="";toast("Verkefni skráð");await loadTasks();renderAll()}
async function completeTask(id){await db.from("tasks").update({completed_at:new Date().toISOString()}).eq("id",id);toast("Verkefni klárað");await loadTasks();renderAll()}
async function addInventory(){const name=$("inventoryName").value.trim();if(!name)return toast("Vantar vöruheiti");await db.from("inventory_items").insert({name,unit:$("inventoryUnit").value.trim(),quantity:Number($("inventoryQty").value||0),min_quantity:Number($("inventoryMin").value||0)});["inventoryName","inventoryUnit","inventoryQty","inventoryMin"].forEach(id=>$(id).value="");toast("Lagerhlut bætt við");await loadInventory();renderAll()}
async function adjustInventory(id,amount){const item=inventory.find(i=>i.id===id);if(!item)return;await db.from("inventory_items").update({quantity:Number(item.quantity||0)+amount}).eq("id",id);await loadInventory();renderAll()}

async function backup(){const all=await Promise.all([db.from("employees").select("*"),db.from("time_entries").select("*"),db.from("customers").select("*"),db.from("orders").select("*"),db.from("production_days").select("*"),db.from("tasks").select("*"),db.from("inventory_items").select("*")]);const data={employees:all[0].data,time_entries:all[1].data,customers:all[2].data,orders:all[3].data,production_days:all[4].data,tasks:all[5].data,inventory_items:all[6].data,exported_at:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="totuos-backup.json";a.click()}
function payrollCSV(){const header=["Starfsmaður","Greiddar mínútur"];const rows=entries.map(e=>[e.employee_name,e.paid_minutes??e.total_minutes].map(csvEscape).join(";"));downloadCSV("totuos-laun.csv",header,rows)}
function monthlyCSV(){
  const m=Number($("adminMonth").value), y=Number($("adminYear").value);
  const rows=monthlyRows.filter(r=>{if(!r.month)return false;const d=new Date(r.month);return d.getMonth()+1===m&&d.getFullYear()===y});
  const header=["Starfsmaður","Mánuður","Vaktir","Klst samtals","Síðasta vakt","Í vinnu"];
  const csvRows=rows.map(r=>[r.employee_name,r.month,r.shift_count,Number(r.total_hours||0).toFixed(2),r.last_shift,r.is_working_now?"Já":"Nei"].map(csvEscape).join(";"));
  downloadCSV(`totuos-manadaryfirlit-${y}-${String(m).padStart(2,"0")}.csv`,header,csvRows);
}

init();
