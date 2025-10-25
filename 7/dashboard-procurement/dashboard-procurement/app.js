/* 
=========================
   FOREST • OPS — app.js
   גרסה: 3.5.0 (Dashboard + Graphs integration)
========================= */
/* ---------- Config ---------- */
const LS_KEY   = 'forest_ops_projects_v1';
const ADMIN_CODE = '2468';
const UNLOCK_WINDOW_MIN = 20;
const LOCK_AFTER_HOURS  = 24;
const SESSION_PREFIX    = 'forest_ops_unlock_';
/* ---------- Utilities ---------- */
function loadProjects(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){ return []; }
    return JSON.parse(raw) || [];
  }catch(e){
    console.warn('loadProjects error:', e);
    return [];
  }
}
function saveProjects(list){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(list||[]));
    window.dispatchEvent(new Event('projects-changed'));
  }catch(e){
    console.warn('saveProjects error:', e);
  }
}
function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function byId(id){ return document.getElementById(id); }
function uuid(){ return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
function nowIso(){ return new Date().toISOString(); }
function fmtCurrency(v){
  const n = parseFloat(String(v ?? '').toString().replace(/[, ]/g,''));
  if (isNaN(n)) return '0 ₪';
  try{
    return new Intl.NumberFormat('he-IL',{ style:'currency', currency:'ILS', maximumFractionDigits:0 }).format(n);
  }catch(_){
    return (Math.round(n)).toLocaleString('he-IL') + ' ₪';
  }
}
/* =======================================================
   דף 1: טבלת פרויקטים
   ======================================================= */
function renderKpis(projects){
  const total = projects.length;
  const done = projects.filter(p=>p.projStatus==='הסתיים').length;
  const inprog = projects.filter(p=>p.projStatus==='בתהליך').length;
  const not = projects.filter(p=>p.projStatus==='לא התחיל').length;
  const cancel = projects.filter(p=>p.projStatus==='מבוטל').length;
  const freeze = projects.filter(p=>p.projStatus==='מוקפא').length;
  byId('kpi-total') && (byId('kpi-total').textContent = total);
  byId('kpi-done') && (byId('kpi-done').textContent = done);
  byId('kpi-in') && (byId('kpi-in').textContent = inprog);
  byId('kpi-not') && (byId('kpi-not').textContent = not);
  byId('kpi-cancel') && (byId('kpi-cancel').textContent = cancel);
  byId('kpi-freeze') && (byId('kpi-freeze').textContent = freeze);
}
/* =======================================================
   דף 2: כרטיס ההתקדמות
   ======================================================= */
const COMPLETED_STATUSES = new Set(['הסתיים','מבוטל','מוקפא']);
const ACTIVITIES_ORDER = [
  'מכרז','ספק יחיד','תחרות','הארכה/הגדלה','מימוש אופציה','חשכ״ל','ניהול משבר','בדיקה הנדסית'
];
const BAR_COLORS = [
  '#b8ff7a','#6ee7ff','#a78bfa','#60a5fa','#fbbf24','#34d399','#f472b6','#94a3b8'
];
function calcProgressData(list){
  const total = list.length;
  const completed = list.filter(p=> COMPLETED_STATUSES.has(p?.projStatus)).length;
  const overallPercent = total ? Math.round((completed/total)*100) : 0;
  const counters = new Map();
  function bump(act, isDone){
    const key = act || 'לא ידוע';
    const cur = counters.get(key) || { total:0, done:0 };
    cur.total += 1;
    if(isDone) cur.done += 1;
    counters.set(key, cur);
  }
  list.forEach(p=> bump(p?.activity, COMPLETED_STATUSES.has(p?.projStatus)));
  const seen = new Set();
  const rows = [];
  ACTIVITIES_ORDER.forEach((name, idx)=>{
    const c = counters.get(name) || {total:0, done:0};
    rows.push({
      name,
      total: c.total,
      done: c.done,
      percent: c.total ? Math.round((c.done/c.total)*100) : 0,
      color: BAR_COLORS[idx % BAR_COLORS.length]
    });
    seen.add(name);
  });
  [...counters.keys()].forEach(name=>{
    if(seen.has(name)) return;
    const c = counters.get(name);
    rows.push({
      name,
      total: c.total,
      done: c.done,
      percent: c.total ? Math.round((c.done/c.total)*100) : 0,
      color: BAR_COLORS[rows.length % BAR_COLORS.length]
    });
  });
  return { total, completed, overallPercent, rows };
}
function renderProgressPanel(list){
  const host = byId('progress-card');
  if(!host) return;
  const { overallPercent, rows } = calcProgressData(list);
  const SIZE = 140, STROKE = 10, R = (SIZE/2) - STROKE, C = 2*Math.PI*R;
  host.innerHTML = `
    <div class="progress-card__inner">
      <div class="ring-wrap">
        <svg class="ring" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
          <circle class="ring-bg" cx="${SIZE/2}" cy="${SIZE/2}" r="${R}" stroke-width="${STROKE}" />
          <circle class="ring-fg" cx="${SIZE/2}" cy="${SIZE/2}" r="${R}" stroke-width="${STROKE}" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/>
        </svg>
        <div class="ring-center">
          <div class="ring-percent">${overallPercent}%</div>
          <div class="ring-label">התקדמות</div>
        </div>
      </div>
      <div class="bars" id="activity-bars">
        ${rows.map(r=>`
          <div class="bar-row">
            <div class="bar-head"><span>${r.name}</span><span dir="ltr">${r.done}/${r.total}</span></div>
            <div class="bar-track"><i class="bar-fill" style="width:0%" data-target="${r.percent}" data-color="${r.color}"></i></div>
          </div>`).join('')}
      </div>
    </div>
  `;
  requestAnimationFrame(()=>{
    const fg = host.querySelector('.ring-fg');
    fg.style.strokeDashoffset = String(C * (1 - (overallPercent/100)));
    host.querySelectorAll('.bar-fill').forEach(el=>{
      el.style.setProperty('--bar-color', el.dataset.color);
      el.style.width = el.dataset.target + '%';
    });
  });
}
/* =======================================================
   דף 3: דשבורד
   ======================================================= */
function initDashboard(){
  let projects = loadProjects();
  let orig = projects.slice();
  const filters = {
    year: byId('f-year'),
    area: byId('f-area'),
    dept: byId('f-dept'),
    unit: byId('f-unit'),
    buyer: byId('f-buyer'),
    activity: byId('f-activity'),
    status: byId('f-status'),
    task: byId('f-task')
  };
  function hydrateFilters(base){
    populateFilterSelect(filters.year, uniq(base.map(p=>p.year)));
    populateFilterSelect(filters.area, uniq(base.map(p=>p.area)));
    populateFilterSelect(filters.dept, uniq(base.map(p=>p.dept)));
    populateFilterSelect(filters.unit, uniq(base.map(p=>p.unit)));
    populateFilterSelect(filters.buyer, uniq(base.map(p=>p.buyer)));
    populateFilterSelect(filters.activity, uniq(base.map(p=>p.activity)));
    populateFilterSelect(filters.status, uniq(base.map(p=>p.projStatus)));
    populateFilterSelect(filters.task, uniq(base.map(p=>p.taskStatus)));
  }
  function applyFilters(){
    const list = orig.filter(p=>{
      if(filters.year?.value && p.year!==filters.year.value) return false;
      if(filters.area?.value && p.area!==filters.area.value) return false;
      if(filters.dept?.value && p.dept!==filters.dept.value) return false;
      if(filters.unit?.value && p.unit!==filters.unit.value) return false;
      if(filters.buyer?.value && p.buyer!==filters.buyer.value) return false;
      if(filters.activity?.value && p.activity!==filters.activity.value) return false;
      if(filters.status?.value && p.projStatus!==filters.status.value) return false;
      if(filters.task?.value && p.taskStatus!==filters.task.value) return false;
      return true;
    });
    renderKpis(list);
    renderProgressPanel(list);
    renderCharts(list); // ✅ חיבור לגרפים
  }
  Object.values(filters).forEach(sel=> sel && sel.addEventListener('change', applyFilters));
  byId('btn-clear-filters')?.addEventListener('click', ()=>{
    Object.values(filters).forEach(sel=>{ if(sel) sel.value=''; });
    applyFilters();
  });
  function reloadPreserveSelections(){
    const keep = Object.fromEntries(Object.entries(filters).map(([k,el])=>[k, el?.value || '']));
    projects = loadProjects();
    orig = projects.slice();
    hydrateFilters(orig);
    Object.entries(keep).forEach(([k,v])=>{ if(filters[k]) filters[k].value=v; });
    applyFilters();
  }
  window.addEventListener('projects-changed', reloadPreserveSelections);
  window.addEventListener('storage', (e)=>{ if(e.key===LS_KEY) reloadPreserveSelections(); });
  hydrateFilters(orig);
  applyFilters();
}
/* 🎯 גרפים דינמיים */
function renderCharts(list){
  if(!list || !list.length){ list = loadProjects(); }
  // פילוח כספי לפי פעילות
  const byActivity={};
  list.forEach(p=>{
    const act=p.activity||'לא מוגדר';
    const val=parseFloat(p.estimatePeriodic||0);
    byActivity[act]=(byActivity[act]||0)+val;
  });
  const ctx1=document.getElementById('chart-activity');
  if(ctx1){
    if(window.chartActivity) window.chartActivity.destroy();
    window.chartActivity=new Chart(ctx1,{
      type:'bar',
      data:{labels:Object.keys(byActivity),
        datasets:[{label:'היקף תקופתי (₪)',backgroundColor:'#3fe1f6',data:Object.values(byActivity)}]},
      options:{plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#fff'}},y:{ticks:{color:'#fff'}}}}
    });
  }
  // פילוח לפי סטטוס
  const byStatus={};
  list.forEach(p=>{
    const s=p.projStatus||'לא מוגדר';
    byStatus[s]=(byStatus[s]||0)+1;
  });
  const ctx2=document.getElementById('chart-status');
  if(ctx2){
    if(window.chartStatus) window.chartStatus.destroy();
    window.chartStatus=new Chart(ctx2,{
      type:'doughnut',
      data:{labels:Object.keys(byStatus),
        datasets:[{data:Object.values(byStatus),
          backgroundColor:['#d6f95c','#3fe1f6','#22c55e','#94a3b8','#60a5fa']}]},
      options:{plugins:{legend:{labels:{color:'#fff'}}}}
    });
  }
  // מגמת סיום לפי חודשים
  const months=['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
  const monthCounts=new Array(12).fill(0);
  list.forEach(p=>{
    if(p.actualEnd){
      const m=new Date(p.actualEnd).getMonth();
      monthCounts[m]++;
    }
  });
  const ctx3=document.getElementById('chart-trend');
  if(ctx3){
    if(window.chartTrend) window.chartTrend.destroy();
    window.chartTrend=new Chart(ctx3,{
      type:'line',
      data:{labels:months,datasets:[{label:'סיום פרויקטים',data:monthCounts,borderColor:'#3fe1f6',fill:false,tension:0.4}]},
      options:{plugins:{legend:{labels:{color:'#0f172a'}}}}
    });
  }
}
/* =======================================================
   Init לפי עמוד
   ======================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  if (byId('dashboard-page'))   initDashboard();
});