const $ = id => document.getElementById(id);
let employees=[], entries=[], customers=[], orders=[], production=[], loggedEmployee=null;
let settings={first_coffee_minutes:15,second_coffee_minutes:15,lunch_minutes:30,overtime_after_hours_day:8};

async function sha256(text){const data=new TextEncoder().encode(text);const hash=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function checkPin(emp,pin){if(emp.pin_hash)return await sha256(pin)===emp.pin_hash;return String(emp.pin_code||"")===String(pin)}
function toast(m){$("toast").textContent=m;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2200)}
function minsText(m){m=Number(m||0);return `${Math.floor(m/60)} klst ${String(m%60).padStart(2,"0")} mín`}
function fmt(v){if(!v)return "";return new Date(v).toLocaleString("is-IS",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function today(){return new Date().toISOString().slice(0,10)}
function skipped(fc,sc,lu){return(!fc?settings.first_coffee_minutes:0)+(!sc?settings.second_coffee_minutes:0)+(!lu?settings.lunch_minutes:0)}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}

async function init(){
  $("orderDate").value=today();$("productionDate").value=today();
  bind(); await loadSettings(); await loadEmployees(); await loadEntries(); await loadCustomers(); await loadOrders(); await loadProduction();
  renderAll();
}
function bind(){
  document.querySelectorAll(".navBtn").forEach(b=>b.onclick=()=>showPage(b.dataset.page,b));
  $("adminBtn").onclick=()=>showPage("admin",document.querySelector('[data-page="admin"]'));
  $("employeeLoginBtn").onclick=employeeLogin;$("employeeLogoutBtn").onclick=employeeLogout;$("clockInBtn").onclick=clockIn;$("clockOutShowBtn").onclick=()=>{$("clockOutBox").classList.toggle("hidden");previewPaid()};$("clockOutBtn").onclick=clockOut;
  ["firstCoffee","secondCoffee","lunch"].forEach(id=>$(id).onchange=previewPaid);
  $("addCustomerBtn").onclick=addCustomer;$("addOrderBtn").onclick=addOrder;$("copyYesterdayBtn").onclick=copyYesterday;$("exportOrdersBtn").onclick=exportOrdersCSV;
  $("saveProductionTargetBtn").onclick=saveProductionTarget;$("addDoughBtn").onclick=()=>addProduction("dough_count",1);$("addBakedBtn").onclick=()=>addProduction("baked_packs",100);$("addPackedBtn").onclick=()=>addProduction("packed_packs",50);$("loadTruckBtn").onclick=()=>addProduction("loaded_trucks",1);
  $("adminLoginBtn").onclick=()=>{if($("adminPassword").value===ADMIN_PASSWORD){$("adminLogin").classList.add("hidden");$("adminPanel").classList.remove("hidden");toast("Stjórnandi skráður inn")}else toast("Rangt lykilorð")};
  $("backupBtn").onclick=backup;$("payrollCsvBtn").onclick=payrollCSV;
}
function showPage(p,btn){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(`page-${p}`).classList.remove("hidden");document.querySelectorAll(".navBtn").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active")}

async function loadSettings(){const{data}=await db.from("app_settings").select("*");(data||[]).forEach(r=>settings[r.key]=Number(r.value))}
async function loadEmployees(){const{data}=await db.from("employees").select("*").order("name");employees=(data||[]).filter(e=>e.active!==false);$("employeeSelect").innerHTML=employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join("")}
async function loadEntries(){const start=new Date(today()+"T00:00:00");const{data}=await db.from("time_entries").select("*").gte("clock_in",start.toISOString()).order("clock_in",{ascending:false});entries=data||[]}
async function loadCustomers(){const{data}=await db.from("customers").select("*").order("chain").order("name");customers=data||[];$("orderCustomer").innerHTML=customers.map(c=>`<option value="${c.id}">${c.chain||""} ${c.name}</option>`).join("")}
async function loadOrders(){const d=$("orderDate").value||today();const{data}=await db.from("orders").select("*, customers(*)").eq("order_date",d).order("created_at");orders=data||[]}
async function loadProduction(){const d=$("productionDate").value||today();const{data}=await db.from("production_days").select("*").eq("work_date",d).limit(1);production=data||[]}

function renderAll(){renderHome();renderTime();renderCustomers();renderOrders();renderProduction()}
function renderHome(){
 const open=entries.filter(e=>!e.clock_out); const paid=entries.reduce((a,e)=>a+Number(e.paid_minutes??e.total_minutes??0),0); const orderPacks=orders.reduce((a,o)=>a+Number(o.packs||0),0); const prod=production[0]||{};
 $("homeStats").innerHTML=`<div class="stat"><span>Í vinnu</span><b>${open.length}</b></div><div class="stat"><span>Pantanir pakkar</span><b>${orderPacks}</b></div><div class="stat"><span>Greitt í dag</span><b>${minsText(paid)}</b></div><div class="stat"><span>Framleiðsla</span><b>${prod.packed_packs||0}/${prod.target_packs||0}</b></div>`;
 $("openEntries").innerHTML=open.length?open.map(e=>`<span class="pill ok">🟢 ${e.employee_name} · ${fmt(e.clock_in)}</span>`).join(""):"<span class='pill'>Enginn skráður inni</span>";
 $("todayOrders").innerHTML=orders.length?orders.map(o=>`<div class="item"><b>${o.customers?.name||"Verslun"}</b><span>${o.packs||0} pakkar · ${o.items||0} stk</span></div>`).join(""):"<span class='pill'>Engar pantanir skráðar</span>";
 $("productionStatus").innerHTML=`<div class="statgrid"><div class="stat"><span>Markmið</span><b>${prod.target_packs||0}</b></div><div class="stat"><span>Deig</span><b>${prod.dough_count||0}</b></div><div class="stat"><span>Bakað</span><b>${prod.baked_packs||0}</b></div><div class="stat"><span>Pakkað</span><b>${prod.packed_packs||0}</b></div></div>`;
}
function renderTime(){const open=entries.filter(e=>!e.clock_out);const paid=entries.reduce((a,e)=>a+Number(e.paid_minutes??e.total_minutes??0),0);$("timeDashboard").innerHTML=`<div class="stat"><span>Í vinnu</span><b>${open.length}</b></div><div class="stat"><span>Skráningar</span><b>${entries.length}</b></div><div class="stat"><span>Greitt</span><b>${minsText(paid)}</b></div><div class="stat"><span>Starfsmenn</span><b>${employees.length}</b></div>`}
function renderCustomers(){$("customersList").innerHTML=customers.length?customers.map(c=>`<div class="item"><div><b>${c.name}</b><br><span class="muted small">${c.chain||"-"} · ${c.route||"-"}</span></div></div>`).join(""):"<span class='pill'>Engar verslanir skráðar</span>"}
function renderOrders(){const total=orders.reduce((a,o)=>a+Number(o.packs||0),0);$("ordersList").innerHTML=`<p class="pill ok">Samtals ${total} pakkar</p>`+(orders.map(o=>`<div class="item"><div><b>${o.customers?.name||"Verslun"}</b><br><span class="muted small">${o.customers?.chain||""}</span></div><div>${o.packs||0} pakkar · ${o.items||0} stk</div></div>`).join("")||"<span class='pill'>Engar pantanir</span>")}
function renderProduction(){const p=production[0]||{};$("productionTarget").value=p.target_packs||""}

async function employeeLogin(){const emp=employees.find(e=>e.id===$("employeeSelect").value);const pin=$("employeePin").value.trim();if(!emp)return toast("Veldu starfsmann");if(!await checkPin(emp,pin))return toast("Rangt PIN");loggedEmployee=emp;$("loggedEmployeeName").textContent=emp.name;$("employeeLogin").classList.add("hidden");$("employeePanel").classList.remove("hidden");$("employeePin").value="";toast("Innskráning tókst")}
function employeeLogout(){loggedEmployee=null;$("employeePanel").classList.add("hidden");$("clockOutBox").classList.add("hidden");$("employeeLogin").classList.remove("hidden")}
async function clockIn(){if(!loggedEmployee)return toast("Skráðu þig inn");const{data:open}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).limit(1);if(open?.length)return toast("Þú ert nú þegar mætt/ur");await db.from("time_entries").insert({employee_id:loggedEmployee.id,employee_name:loggedEmployee.name,clock_in:new Date().toISOString()});toast("Mæting skráð");await loadEntries();renderAll();setTimeout(employeeLogout,900)}
async function previewPaid(){if(!loggedEmployee)return;const{data}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).order("clock_in",{ascending:false}).limit(1);if(!data?.length){$("paidPreview").textContent="Engin opin mæting fannst";return}const base=Math.max(0,Math.round((new Date()-new Date(data[0].clock_in))/60000));const s=skipped($("firstCoffee").checked,$("secondCoffee").checked,$("lunch").checked);$("paidPreview").innerHTML=`Rauntími: <b>${minsText(base)}</b><br>Sleppt hlé: <b>+${minsText(s)}</b><br>Greiddur tími: <b>${minsText(base+s)}</b>`}
async function clockOut(){if(!loggedEmployee)return;const{data}=await db.from("time_entries").select("*").eq("employee_id",loggedEmployee.id).is("clock_out",null).order("clock_in",{ascending:false}).limit(1);if(!data?.length)return toast("Engin opin mæting");const e=data[0],out=new Date(),base=Math.max(0,Math.round((out-new Date(e.clock_in))/60000));const fc=$("firstCoffee").checked,sc=$("secondCoffee").checked,lu=$("lunch").checked,s=skipped(fc,sc,lu);await db.from("time_entries").update({clock_out:out.toISOString(),total_minutes:base,paid_minutes:base+s,skipped_break_minutes:s,first_coffee:fc,second_coffee:sc,lunch:lu}).eq("id",e.id);toast("Heimferð skráð");await loadEntries();renderAll();setTimeout(employeeLogout,900)}

async function addCustomer(){const name=$("customerName").value.trim();if(!name)return toast("Vantar nafn verslunar");await db.from("customers").insert({name,chain:$("customerChain").value.trim(),route:$("customerRoute").value.trim()});["customerName","customerChain","customerRoute"].forEach(id=>$(id).value="");toast("Verslun bætt við");await loadCustomers();renderCustomers()}
async function addOrder(){const customer_id=$("orderCustomer").value;if(!customer_id)return toast("Vantar verslun");await db.from("orders").insert({order_date:$("orderDate").value||today(),customer_id,packs:Number($("orderPacks").value||0),items:Number($("orderItems").value||0),status:"Skráð"});$("orderPacks").value="";$("orderItems").value="";toast("Pöntun skráð");await loadOrders();renderAll()}
async function copyYesterday(){const d=new Date($("orderDate").value||today());const y=new Date(d);y.setDate(y.getDate()-1);const ystr=y.toISOString().slice(0,10);const{data}=await db.from("orders").select("*").eq("order_date",ystr);if(!data?.length)return toast("Engar pantanir í gær");const rows=data.map(o=>({order_date:$("orderDate").value||today(),customer_id:o.customer_id,packs:o.packs,items:o.items,status:"Afritað"}));await db.from("orders").insert(rows);toast("Gærdagurinn afritaður");await loadOrders();renderAll()}
function exportOrdersCSV(){const header=["Dagur","Keðja","Verslun","Pakkar","Stykki"];const rows=orders.map(o=>[o.order_date,o.customers?.chain,o.customers?.name,o.packs,o.items].map(csvEscape).join(";"));const blob=new Blob(["\ufeff"+header.join(";")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="totuos-pantanir.csv";a.click()}

async function saveProductionTarget(){const d=$("productionDate").value||today();const target=Number($("productionTarget").value||0);await db.from("production_days").upsert({work_date:d,target_packs:target});toast("Markmið vistað");await loadProduction();renderAll()}
async function addProduction(field,amount){const d=$("productionDate").value||today();let p=production[0];if(!p){await db.from("production_days").insert({work_date:d,target_packs:Number($("productionTarget").value||0)});await loadProduction();p=production[0]}const value=Number(p[field]||0)+amount;await db.from("production_days").update({[field]:value}).eq("id",p.id);await loadProduction();renderAll()}

async function backup(){const all=await Promise.all([db.from("employees").select("*"),db.from("time_entries").select("*"),db.from("customers").select("*"),db.from("orders").select("*"),db.from("production_days").select("*")]);const data={employees:all[0].data,time_entries:all[1].data,customers:all[2].data,orders:all[3].data,production_days:all[4].data,exported_at:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="totuos-backup.json";a.click()}
function payrollCSV(){const header=["Starfsmaður","Greiddar mínútur"];const rows=entries.map(e=>[e.employee_name,e.paid_minutes??e.total_minutes].map(csvEscape).join(";"));const blob=new Blob(["\ufeff"+header.join(";")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="totuos-laun.csv";a.click()}
init();
