// Adhkar App - modern, fast, RTL
// Tiny state mgmt + rendering + persistence
import { ADHKAR_DATA } from './data.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = 'adhkar.progress.v1';
const SETTINGS_KEY = 'adhkar.settings.v1';
const STREAK_KEY = 'adhkar.streak.v1';

const categories = [
  { id: 'wake-up', title: 'أذكار الاستيقاظ' },
  { id: 'morning', title: 'أذكار الصباح' },
  { id: 'evening', title: 'أذكار المساء' },
  { id: 'after-prayer', title: 'أذكار بعد الصلاة' },
  { id: 'tasbih', title: 'تسابيح' },
  { id: 'sleep', title: 'أذكار النوم' },
  { id: 'jawami', title: 'جوامع الدعاء' },
  { id: 'prophetic', title: 'أدعية النبي ﷺ' },
  { id: 'quran-duas', title: 'الأدعية القرآنية' },
  { id: 'prophets', title: 'أدعية الأنبياء' },
  { id: 'misc', title: 'أذكار متفرقة' },
  { id: 'adhan', title: 'أذكار الأذان' },
  { id: 'mosque', title: 'أذكار المسجد' },
  { id: 'wudu', title: 'أذكار الوضوء' },
  { id: 'home-family', title: 'البيت والأسرة' },
  { id: 'bathroom', title: 'أذكار الخلاء' },
  { id: 'food', title: 'أذكار الطعام' },
  { id: 'hajj-umrah', title: 'الحج والعمرة' },
  { id: 'khatm-quran', title: 'دعاء ختم القرآن' },
  { id: 'fadhail-dua', title: 'فضل الدعاء' },
  { id: 'fadhail-dhikr', title: 'فضل الذكر' },
  { id: 'fadhail-suwar', title: 'فضائل السور' },
  { id: 'asmaul-husna', title: 'الأسماء الحسنى' },
  { id: 'ruqyah', title: 'الرُّقية الشرعية' },
  { id: 'illness', title: 'المرض' },
  { id: 'death', title: 'الوفاة' },
];

// Normalize data and assign stable IDs
const data = Object.fromEntries(Object.entries(ADHKAR_DATA).map(([cat, items]) => [
  cat,
  items.map((it, i) => ({ id: `${cat}-${i+1}` , ...it }))
]));

// Category title lookup
const categoryTitleById = Object.fromEntries(categories.map(c => [c.id, c.title]));

// Normalize Arabic text for search: remove diacritics/tatweel and unify common letters
function normalizeArabic(s){
  if(!s) return '';
  return String(s)
    .toLowerCase()
    // remove harakat/diacritics and Qur'anic marks
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // remove tatweel
    .replace(/\u0640/g, '')
    // unify alef forms
    .replace(/[إأآٱ]/g, 'ا')
    // unify yaa/maqsuura
    .replace(/ى/g, 'ي')
    // unify taa marbuta
    .replace(/ة/g, 'ه')
    .trim();
}

// Persistence
function todayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`; // local date
}
function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { date: todayKey(), counts: {} };
    const parsed = JSON.parse(raw);
    if(parsed.date !== todayKey()) return { date: todayKey(), counts: {} };
    return parsed;
  }catch(_e){
    console.warn('Failed to load progress, resetting for today.', _e);
    return { date: todayKey(), counts: {} };
  }
}
function saveProgress(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSettings(){
  try{
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  }catch(_e){ console.warn('Failed to load settings, using defaults.', _e); return {}; }
}
function saveSettings(st){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
}

// Pick default tab by time: 4:00-11:59 morning, 12:00-23:59 evening
const now = new Date();
const hour = now.getHours();
const defaultTab = (hour >= 4 && hour < 12) ? 'morning' : 'evening';

const state = {
  tab: defaultTab,
  filter: '',
  progress: loadProgress(),
  settings: loadSettings(),
  streak: loadStreak(),
};

// Theme
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
if (state.settings.theme === 'light' || (!state.settings.theme && prefersLight)) {
  document.documentElement.classList.add('light');
}

// UI Bindings
$('#themeToggle').addEventListener('click',()=>{
  document.documentElement.classList.toggle('light');
  state.settings.theme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
  saveSettings(state.settings);
});

$('#settingsBtn').addEventListener('click',()=> $('#settingsDialog').showModal());
$('#spaceToCount').checked = !!state.settings.spaceToCount;
$('#reduceMotion').checked = !!state.settings.reduceMotion;
$('#spaceToCount').addEventListener('change', e=>{ state.settings.spaceToCount = e.target.checked; saveSettings(state.settings); });
$('#reduceMotion').addEventListener('change', e=>{ state.settings.reduceMotion = e.target.checked; document.body.style.scrollBehavior = e.target.checked ? 'auto' : ''; saveSettings(state.settings); });

// Tabs (render dynamically from categories)
function renderTabs() {
  const tabsWrap = document.querySelector('.tabs');
  if (!tabsWrap) return;
  tabsWrap.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.type = 'button';
    btn.dataset.tab = cat.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(state.tab === cat.id));
    if (state.tab === cat.id) btn.classList.add('active');
    btn.textContent = cat.title;
    btn.addEventListener('click', () => {
      state.tab = cat.id;
      // update active states
      document.querySelectorAll('.tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === state.tab);
        b.setAttribute('aria-selected', String(b.dataset.tab === state.tab));
      });
      render();
    });
    tabsWrap.appendChild(btn);
  });
}

// Streak handling
function loadStreak(){
  try{
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDay: null };
  }catch{ return { count: 0, lastDay: null }; }
}
function saveStreak(s){ localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }

// Define which categories count toward daily completion
const REQUIRED_CATEGORIES = ['morning','evening','after-prayer'];
// Consider a category complete when the user reaches this percentage of its total targets
const COMPLETION_THRESHOLD = 0.7; // 70%

function isCategoryComplete(catId){
  const items = data[catId] || [];
  if(!items.length) return false;
  // Sum progress vs targets and compare to threshold
  let totalTarget = 0;
  let totalProgress = 0;
  for (const it of items) {
    const t = Math.max(1, Number(it.target) || 1);
    const c = Math.max(0, Math.min(t, state.progress.counts[it.id] || 0));
    totalTarget += t;
    totalProgress += c;
  }
  if (totalTarget <= 0) return false;
  const ratio = totalProgress / totalTarget;
  return ratio >= COMPLETION_THRESHOLD;
}

function isDayComplete(){
  return REQUIRED_CATEGORIES.every(isCategoryComplete);
}

function updateStreakIfNeeded(){
  const today = todayKey();
  const st = state.streak || { count:0, lastDay:null };
  if (!isDayComplete()) {
    // Not complete today; do not change streak proactively
    renderStreak();
    return;
  }
  if (st.lastDay === today) {
    // Already counted today
    renderStreak();
    return;
  }
  // Check if yesterday was lastDay to continue streak, else reset to 1
  const d = new Date(today);
  const yest = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1);
  const yKey = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;
  const nextCount = (st.lastDay === yKey) ? (st.count||0)+1 : 1;
  state.streak = { count: nextCount, lastDay: today };
  saveStreak(state.streak);
  renderStreak();
}

function renderStreak(){
  const el = document.getElementById('streak');
  if(!el) return;
  const c = state.streak?.count || 0;
  el.textContent = `🔥 ${c}`;
  el.setAttribute('aria-label', `سلسلة الأيام المكتملة: ${c}`);
}

// Search
let searchTimer;
$('#searchInput').addEventListener('input', (e)=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{
    const v = (typeof e?.target?.value === 'string') ? e.target.value.trim() : '';
    state.filter = v;
    render();
  }, 120);
});

// Keyboard quick count
document.addEventListener('keydown', (e)=>{
  if(state.settings.spaceToCount && e.code === 'Space'){
    const firstIncomplete = $('#cards .card:not(.done) .increment');
    if(firstIncomplete){ e.preventDefault(); firstIncomplete.click(); }
  }
});

function getCounts(id){
  return state.progress.counts[id] || 0;
}
function setCounts(id, val){
  state.progress.counts[id] = Math.max(0, val);
  saveProgress(state.progress);
}

function cardHTML(item){
  const cnt = getCounts(item.id);
  const pct = Math.min(100, Math.round((cnt / item.target) * 100));
  return { cnt, pct };
}

function render(){
  const wrap = $('#cards');
  wrap.innerHTML = '';
  const qRaw = state?.filter || '';
  const q = normalizeArabic(qRaw);
  // When searching, search across all categories; otherwise, show current tab
  const baseList = q
    ? categories.flatMap(cat => (data[cat.id] || []).map(it => ({ ...it, _catId: cat.id })))
    : (data[state.tab] || []).map(it => ({ ...it, _catId: state.tab }));
  const filtered = q
    ? baseList.filter(x => {
        const blob = normalizeArabic(`${x.title || ''} ${x.text || ''} ${x.note || ''}`);
        return blob.includes(q);
      })
    : baseList;

  filtered.forEach(item => {
    const tpl = $('#cardTemplate').content.cloneNode(true);
    const el = tpl.querySelector('.card');
    el.dataset.id = item.id;
    if (item.title) { const h = tpl.querySelector('.title'); h.textContent = item.title; h.hidden = false; h.setAttribute('aria-hidden','false'); } else { tpl.querySelector('.title').remove(); }
    tpl.querySelector('.text').textContent = item.text;
    if (item.note) { tpl.querySelector('.note').textContent = item.note; } else { tpl.querySelector('.note').remove(); }

    // If this is a cross-category search, show a small category chip
    if (q) {
      const chip = document.createElement('div');
      chip.className = 'cat-chip';
      chip.textContent = categoryTitleById[item._catId] || '';
      el.appendChild(chip);
    }

    const { cnt, pct } = cardHTML(item);
    tpl.querySelector('.current').textContent = cnt;
    tpl.querySelector('.target').textContent = item.target;
    tpl.querySelector('.bar').style.width = pct + '%';
    if (cnt >= item.target) el.classList.add('done');

    const incBtn = tpl.querySelector('.increment');
    const undoBtn = tpl.querySelector('.undo');
    const resetBtn = tpl.querySelector('.reset');

    incBtn.addEventListener('click',()=>{
      const c = Math.min(item.target, getCounts(item.id) + 1);
      setCounts(item.id, c); render();
    });
    undoBtn.addEventListener('click',()=>{ setCounts(item.id, getCounts(item.id)-1); render(); });
    resetBtn.addEventListener('click',()=>{ setCounts(item.id, 0); render(); });

    wrap.appendChild(tpl);
  });

  // Empty state
  if(!filtered.length){
    wrap.innerHTML = `<div style="opacity:.7;padding:28px;text-align:center">لا توجد نتائج مطابقة.</div>`;
  }

  // Re-evaluate streak after each render since completion may change
  updateStreakIfNeeded();
}

// Initialize daily reset if needed
if(state.progress.date !== todayKey()){
  state.progress = { date: todayKey(), counts: {} };
  saveProgress(state.progress);
}

render();

// Initial tabs render and sync
renderTabs();

// Initial streak render
renderStreak();

// Auto-reset at local midnight even if the app stays open
function scheduleMidnightReset(){
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 2); // 2s after midnight
  const delay = Math.max(1000, next.getTime() - now.getTime());
  setTimeout(()=>{
    // If the stored date differs, reset and re-render
    if(state.progress.date !== todayKey()){
      state.progress = { date: todayKey(), counts: {} };
      saveProgress(state.progress);
      render();
    }
    scheduleMidnightReset();
  }, delay);
}
scheduleMidnightReset();
