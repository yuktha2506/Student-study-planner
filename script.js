const COLORS = [
  '#a8e6cf','#93c5fd','#f9a8d4','#fcd34d',
  '#c4b5fd','#6ee7b7','#fca5a5','#7dd3fc'
];

const DEFAULT_SUBJECTS = [
  { id: 1, name: 'Mathematics', color: '#93c5fd' },
  { id: 2, name: 'Science',     color: '#a8e6cf' },
  { id: 3, name: 'English',     color: '#f9a8d4' },
];

/* ══════════════════════════════════════════════════
   HELPERS (needed before load)
══════════════════════════════════════════════════ */
function today() {
  return new Date().toISOString().split('T')[0];
}
function offsetDate(d) {
  const dt = new Date(); dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
}

/* ══════════════════════════════════════════════════
   PERSISTENCE
══════════════════════════════════════════════════ */
function loadData() {
  try {
    const raw = localStorage.getItem('studybloom');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function save() {
  try {
    localStorage.setItem('studybloom', JSON.stringify({
      subjects, tasks, sessions, reminders, nextId, streakDays
    }));
  } catch(e) {}
}

/* ══════════════════════════════════════════════════
   STATE  (loaded from storage or seeded fresh)
══════════════════════════════════════════════════ */
const _saved = loadData();

let subjects   = _saved ? _saved.subjects   : DEFAULT_SUBJECTS;
let tasks      = _saved ? _saved.tasks      : [
  { id: 1, name: 'Read Chapter 3', subjectId: 1, date: today(), priority: 'high',   done: false },
  { id: 2, name: 'Essay Draft',    subjectId: 3, date: today(), priority: 'medium', done: true  },
  { id: 3, name: 'Lab Report',     subjectId: 2, date: offsetDate(2), priority: 'low', done: false },
];
let sessions   = _saved ? _saved.sessions   : [];
let reminders  = _saved ? _saved.reminders  : [];
let nextId     = _saved ? _saved.nextId     : 100;
let streakDays = _saved ? _saved.streakDays : 3;

let taskFilter    = 'all';
let weekOffset    = 0;
let selectedColor = COLORS[0];

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
window.onload = () => {
  updateHeaderDate();
  renderColorRow();
  populateSubjectDropdowns();
  renderSubjectChips();
  renderDashboard();
  renderTasks();
  renderTimetable();
  renderProgress();
  renderReminders();
  setDefaultDates();
  setInterval(checkReminders, 30000);
};

function updateHeaderDate() {
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('en-US', opts);
}

function setDefaultDates() {
  const t = today();
  ['taskDate','qTaskDate','reminderDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = t;
  });
  const rt = document.getElementById('reminderTime');
  if (rt) rt.value = '08:00';
}

/* ══════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════ */
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    const b = document.querySelector(`[data-tab="${tab}"]`);
    if (b) b.classList.add('active');
  }
  if (tab === 'progress') renderProgress();
}

/* ══════════════════════════════════════════════════
   SUBJECTS
══════════════════════════════════════════════════ */
function renderColorRow() {
  const row = document.getElementById('colorRow');
  row.innerHTML = COLORS.map(c =>
    `<div class="color-swatch ${c===selectedColor?'selected':''}"
         style="background:${c}"
         onclick="selectColor('${c}',this)"></div>`
  ).join('');
}

function selectColor(c, el) {
  selectedColor = c;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function addSubject() {
  const name = document.getElementById('subjectNameInput').value.trim();
  if (!name) { toast('Please enter a subject name', 'warning'); return; }
  if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    toast('Subject already exists', 'warning'); return;
  }
  subjects.push({ id: nextId++, name, color: selectedColor });
  document.getElementById('subjectNameInput').value = '';
  save();
  renderSubjectChips();
  populateSubjectDropdowns();
  renderDashboard();
  renderProgress();
  toast(`"${name}" added! 📚`);
}

function deleteSubject(id) {
  subjects = subjects.filter(s => s.id !== id);
  tasks = tasks.filter(t => t.subjectId !== id);
  sessions = sessions.filter(s => s.subjectId !== id);
  save();
  renderSubjectChips();
  populateSubjectDropdowns();
  renderDashboard(); renderTasks(); renderTimetable(); renderProgress();
  toast('Subject removed');
}

function renderSubjectChips() {
  const el = document.getElementById('subjectChips');
  if (!subjects.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px;">No subjects yet</div>'; return; }
  el.innerHTML = subjects.map(s => {
    const cnt = tasks.filter(t => t.subjectId === s.id).length;
    return `<div class="subject-chip" style="background:${s.color}20;color:${darken(s.color)};">
      <div class="chip-dot" style="background:${s.color}"></div>
      <span class="chip-name">${s.name}</span>
      <span class="chip-count">${cnt}</span>
      <button class="chip-del" onclick="deleteSubject(${s.id})">✕</button>
    </div>`;
  }).join('');
}

function darken(hex) {
  // Return a darkened version for text
  return hex; // simplified — colours chosen are already readable
}

function populateSubjectDropdowns() {
  const opts = '<option value="">Select subject…</option>' +
    subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  ['taskSubject','qTaskSubject','sessionSubject'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/* ══════════════════════════════════════════════════
   TASKS
══════════════════════════════════════════════════ */
function addTask() {
  const name = document.getElementById('taskName').value.trim();
  const subjectId = parseInt(document.getElementById('taskSubject').value);
  const date = document.getElementById('taskDate').value;
  const priority = document.getElementById('taskPriority').value;
  if (!name) { toast('Enter a task name', 'warning'); return; }
  tasks.push({ id: nextId++, name, subjectId: subjectId||null, date, priority, done: false });
  document.getElementById('taskName').value = '';
  save();
  renderTasks(); renderDashboard(); renderProgress(); renderSubjectChips();
  toast('Task added! ✅');
}

function quickAddTask() {
  const name = document.getElementById('qTaskName').value.trim();
  const subjectId = parseInt(document.getElementById('qTaskSubject').value);
  const date = document.getElementById('qTaskDate').value;
  if (!name) { toast('Enter a task name', 'warning'); return; }
  tasks.push({ id: nextId++, name, subjectId: subjectId||null, date, priority: 'medium', done: false });
  document.getElementById('qTaskName').value = '';
  save();
  renderTasks(); renderDashboard(); renderProgress(); renderSubjectChips();
  toast('Task added! ✅');
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; }
  save();
  renderTasks(); renderDashboard(); renderProgress();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  renderTasks(); renderDashboard(); renderProgress(); renderSubjectChips();
}

function filterTasks(f, btn) {
  taskFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTasks();
}

function renderTasks() {
  const el = document.getElementById('tasksList');
  const t0 = today();
  let filtered = [...tasks];
  if (taskFilter === 'pending') filtered = filtered.filter(t => !t.done);
  else if (taskFilter === 'done') filtered = filtered.filter(t => t.done);
  else if (taskFilter === 'high') filtered = filtered.filter(t => t.priority === 'high' && !t.done);
  else if (taskFilter === 'today') filtered = filtered.filter(t => t.date === t0);

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No tasks here yet!</p></div>`;
    return;
  }
  // Sort: undone first, then by date
  filtered.sort((a,b) => a.done - b.done || (a.date||'').localeCompare(b.date||''));

  el.innerHTML = filtered.map(t => {
    const subj = subjects.find(s => s.id === t.subjectId);
    const overdue = t.date && t.date < t0 && !t.done;
    const dueLabel = t.date ? (t.date === t0 ? '📅 Today' : formatDate(t.date)) : '';
    return `<div class="task-card ${t.done?'done':''}" style="border-left-color:${subj?subj.color:'var(--border)'}">
      <div class="task-checkbox" onclick="toggleTask(${t.id})">${t.done?'✓':''}</div>
      <div class="task-info">
        <div class="task-name">${t.name}</div>
        <div class="task-meta">
          ${subj?`<span class="task-subject-badge" style="background:${subj.color}30;color:${subj.color}">${subj.name}</span>`:''}
          ${dueLabel?`<span class="task-due ${overdue?'overdue':''}">${overdue?'⚠️ Overdue · ':''}${dueLabel}</span>`:''}
          <span class="task-priority priority-${t.priority}">${{high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'}[t.priority]}</span>
        </div>
      </div>
      <button class="task-del-btn" onclick="deleteTask(${t.id})">🗑️</button>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════ */
function renderDashboard() {
  const done = tasks.filter(t => t.done).length;
  const pending = tasks.filter(t => !t.done).length;
  document.getElementById('statCompleted').textContent = done;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statSubjects').textContent  = subjects.length;
  document.getElementById('statStreak').textContent    = streakDays;

  // Subject progress
  const dp = document.getElementById('dashProgress');
  if (!subjects.length) { dp.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><p>Add subjects first</p></div>'; }
  else {
    dp.innerHTML = subjects.map(s => {
      const total = tasks.filter(t => t.subjectId === s.id).length;
      const comp  = tasks.filter(t => t.subjectId === s.id && t.done).length;
      const pct   = total ? Math.round(comp/total*100) : 0;
      return `<div class="progress-item">
        <div class="progress-label"><span>${s.name}</span><span>${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${s.color}"></div></div>
      </div>`;
    }).join('');
  }

  // Today's tasks
  const tt = document.getElementById('todayTasks');
  const todayTasks = tasks.filter(t => t.date === today());
  if (!todayTasks.length) { tt.innerHTML = '<div class="empty-state"><div class="empty-icon">🌟</div><p>No tasks today!</p></div>'; }
  else {
    tt.innerHTML = todayTasks.map(t => {
      const s = subjects.find(s => s.id === t.subjectId);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="width:10px;height:10px;border-radius:50%;background:${s?s.color:'#ccc'};flex-shrink:0"></div>
        <span style="flex:1;font-weight:600;font-size:.9rem;${t.done?'text-decoration:line-through;opacity:.5':''}">${t.name}</span>
        <span style="font-size:.75rem;color:var(--muted)">${{high:'🔴',medium:'🟡',low:'🟢'}[t.priority]}</span>
      </div>`;
    }).join('');
  }
}

/* ══════════════════════════════════════════════════
   TIMETABLE
══════════════════════════════════════════════════ */
const HOURS = Array.from({length:14}, (_,i) => i+7); // 7am–8pm
const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getWeekStart(offset) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset*7;
  d.setDate(diff);
  return d;
}

function renderTimetable() {
  const ws = getWeekStart(weekOffset);
  const we = new Date(ws); we.setDate(we.getDate()+6);
  document.getElementById('weekLabel').textContent =
    `${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;

  const todayName = new Date().toLocaleDateString('en-US',{weekday:'long'});

  // Header
  const hdr = document.getElementById('timetableHeader');
  hdr.innerHTML = `<div class="th-cell">Time</div>` +
    DAYS.map(d => `<div class="th-cell ${d===todayName?'today':''}">${d.slice(0,3)}</div>`).join('');

  // Body
  const body = document.getElementById('timetableBody');
  // Populate session start select
  const ss = document.getElementById('sessionStart');
  if (ss) ss.innerHTML = HOURS.map(h => `<option value="${h}">${h===12?'12 PM':h<12?h+' AM':(h-12)+' PM'}</option>`).join('');

  body.innerHTML = HOURS.map(h => {
    const timeLabel = h===12?'12 PM':h<12?h+' AM':(h-12)+' PM';
    const cells = DAYS.map(day => {
      const sesh = sessions.filter(s => s.day===day && s.startHour===h);
      const blocks = sesh.map(s => {
        const subj = subjects.find(sub => sub.id===s.subjectId);
        return `<div class="time-block" style="background:${subj?subj.color+'40':'#e2e8f0'};color:${subj?subj.color:'#555'}">
          📖 ${subj?subj.name:'Study'}
          <button class="del-block" onclick="deleteSession(${s.id})">✕</button>
        </div>`;
      }).join('');
      return `<div class="time-cell" onclick="openAddSessionModalAt('${day}',${h})">${blocks}</div>`;
    }).join('');
    return `<div class="time-row">
      <div class="time-label">${timeLabel}</div>
      ${cells}
    </div>`;
  }).join('');
}

function changeWeek(d) { weekOffset += d; renderTimetable(); }
function goToToday()   { weekOffset = 0; renderTimetable(); }

function openAddSessionModal() {
  document.getElementById('sessionModal').classList.add('open');
}
function openAddSessionModalAt(day, hour) {
  document.getElementById('sessionDay').value = day;
  document.getElementById('sessionStart').value = hour;
  document.getElementById('sessionModal').classList.add('open');
}
function closeModal() {
  document.getElementById('sessionModal').classList.remove('open');
}

function addSession() {
  const subjectId = parseInt(document.getElementById('sessionSubject').value);
  const day = document.getElementById('sessionDay').value;
  const startHour = parseInt(document.getElementById('sessionStart').value);
  const duration = parseInt(document.getElementById('sessionDuration').value);
  if (!subjectId) { toast('Select a subject', 'warning'); return; }
  for (let i=0; i<duration; i++) {
    sessions.push({ id: nextId++, subjectId, day, startHour: startHour+i });
  }
  closeModal();
  save();
  renderTimetable();
  toast('Study session added! 📅');
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  save();
  renderTimetable();
}

/* ══════════════════════════════════════════════════
   PROGRESS
══════════════════════════════════════════════════ */
function renderProgress() {
  document.getElementById('streakNum').textContent = streakDays;

  const po = document.getElementById('progressOverview');
  if (!subjects.length) {
    po.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📊</div><p>Add subjects to see progress</p></div>';
  } else {
    po.innerHTML = subjects.map(s => {
      const total = tasks.filter(t => t.subjectId === s.id).length;
      const comp  = tasks.filter(t => t.subjectId === s.id && t.done).length;
      const pct   = total ? Math.round(comp/total*100) : 0;
      const r = 36, circ = 2*Math.PI*r;
      const dash = circ - (pct/100)*circ;
      return `<div class="subject-progress-card">
        <div class="circular-progress">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle class="bg-circle" cx="45" cy="45" r="${r}"/>
            <circle class="fill-circle" cx="45" cy="45" r="${r}"
              stroke="${s.color}"
              stroke-dasharray="${circ}"
              stroke-dashoffset="${dash}"/>
          </svg>
          <div class="pct-text" style="color:${s.color}">${pct}%</div>
        </div>
        <div class="sp-name">${s.name}</div>
        <div class="sp-sub">${comp} / ${total} tasks</div>
      </div>`;
    }).join('');
  }

  // Weekly bar chart
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const randomData = days.map(() => Math.floor(Math.random()*8));
  const max = Math.max(...randomData, 1);
  const colors = [
    'var(--mint-mid)','var(--lavender-mid)','var(--peach-mid)',
    'var(--sky-mid)','var(--rose-mid)','var(--mint-mid)','var(--lavender-mid)'
  ];
  document.getElementById('weeklyChart').innerHTML = days.map((d,i) =>
    `<div class="chart-col">
      <div class="chart-bar" style="height:${(randomData[i]/max)*100}%;background:${colors[i]}"></div>
      <div class="chart-day">${d}</div>
    </div>`
  ).join('');
}

/* ══════════════════════════════════════════════════
   REMINDERS
══════════════════════════════════════════════════ */
const REMINDER_ICONS = ['⏰','📌','🎯','📖','✏️','🔔','⚡','🌟'];
const REMINDER_COLORS = [
  'var(--mint)','var(--lavender)','var(--peach)','var(--sky)','var(--rose)'
];

function addReminder() {
  const text = document.getElementById('reminderText').value.trim();
  const date = document.getElementById('reminderDate').value;
  const time = document.getElementById('reminderTime').value;
  if (!text) { toast('Enter a reminder message', 'warning'); return; }
  reminders.push({
    id: nextId++, text, date, time,
    icon: REMINDER_ICONS[Math.floor(Math.random()*REMINDER_ICONS.length)],
    color: REMINDER_COLORS[Math.floor(Math.random()*REMINDER_COLORS.length)]
  });
  document.getElementById('reminderText').value = '';
  save();
  renderReminders();
  toast('Reminder set! 🔔');
}

function deleteReminder(id) {
  reminders = reminders.filter(r => r.id !== id);
  save();
  renderReminders();
}

function renderReminders() {
  const el = document.getElementById('reminderList');
  if (!reminders.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔕</div><p>No reminders yet. Add one above!</p></div>`;
    return;
  }
  reminders.sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  el.innerHTML = reminders.map(r =>
    `<div class="reminder-card">
      <div class="reminder-icon" style="background:${r.color}">${r.icon}</div>
      <div class="reminder-info">
        <div class="reminder-title">${r.text}</div>
        <div class="reminder-time">📅 ${r.date?formatDate(r.date):''} ${r.time?'· ⏰ '+formatTime(r.time):''}</div>
      </div>
      <button class="reminder-del" onclick="deleteReminder(${r.id})">🗑️</button>
    </div>`
  ).join('');
}

function checkReminders() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  reminders.forEach(r => {
    if (r.date === dateStr && r.time === timeStr) {
      toast(`⏰ Reminder: ${r.text}`, 'info');
    }
  });
}

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const [h,m] = t.split(':').map(Number);
  const ampm = h>=12?'PM':'AM';
  return `${h%12||12}:${m.toString().padStart(2,'0')} ${ampm}`;
}

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${{success:'✅',warning:'⚠️',info:'ℹ️'}[type]}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
