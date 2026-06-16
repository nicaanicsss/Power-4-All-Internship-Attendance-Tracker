/* ====================================================
   POWER 4 ALL — Intern Agenda Calendar
   JavaScript Logic
   ==================================================== */

// ==================== SAFE STORAGE WRAPPERS ====================
window.memoryStorage = window.memoryStorage || {};
window.sessionMemoryStorage = window.sessionMemoryStorage || {};

const safeLocalStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return window.memoryStorage[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            window.memoryStorage[key] = String(value);
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            delete window.memoryStorage[key];
        }
    }
};

const safeSessionStorage = {
    getItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return window.sessionMemoryStorage[key] || null;
        }
    },
    setItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            window.sessionMemoryStorage[key] = String(value);
        }
    },
    removeItem(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            delete window.sessionMemoryStorage[key];
        }
    }
};

// ==================== DATA STORE ====================
const STORAGE_KEY = 'p4a_agendas';
let agendas = JSON.parse(safeLocalStorage.getItem(STORAGE_KEY) || '[]');
let currentView = 'calendar';
let calYear, calMonth;
let selectedDateStr = null;
let pendingDateStr = null; // used when "Add for this day" is clicked
let lastAddedIds = []; // keeps track of last inserted IDs for instant Undone/revert

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication. Since index.html manages the login UI overlay, redirect there if unauthorized
    const sessionUser = safeSessionStorage.getItem('p4a_logged_in_user');
    if (!sessionUser) {
        window.location.href = 'index.html';
        return;
    }

    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    setDefaultDate();
    renderHeroStats();
    buildNotifications();
    requestNotifPermission();
    spawnParticles();
    // Auto-select today to show today's tasks below the calendar immediately
    selectDate(todayStr());
    // Check notifications periodically
    setInterval(buildNotifications, 60000);
    // Daily notification check
    checkDailyNotifications();
});

function setDefaultDate() {
    const today = new Date();
    document.getElementById('agDate').value = formatDateInput(today);
}

// ==================== LOCAL STORAGE ====================
function saveData() {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(agendas));
}

// ==================== HELPERS ====================
function formatDateInput(d) {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function todayStr() {
    return formatDateInput(new Date());
}

function tomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateInput(d);
}

function getDateStatus(dateStr) {
    const today = todayStr();
    const tomorrow = tomorrowStr();
    if (dateStr < today) return 'overdue';
    if (dateStr === today) return 'today';
    if (dateStr === tomorrow) return 'tomorrow';
    return 'upcoming';
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCatIcon(cat) {
    const icons = { task: 'fa-clipboard-list', meeting: 'fa-handshake', task_meeting: 'fa-briefcase', deadline: 'fa-clock', reminder: 'fa-bell', event: 'fa-star' };
    return icons[cat] || 'fa-calendar';
}

function getCatLabel(cat) {
    const labels = { task: '📋 Task', meeting: '🤝 Meeting', task_meeting: '📋🤝 Task & Meeting', deadline: '⏰ Deadline', reminder: '🔔 Reminder', event: '🎉 Event' };
    return labels[cat] || cat;
}

function getPriLabel(pri) {
    const labels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
    return labels[pri] || pri;
}

// ==================== HERO STATS ====================
function renderHeroStats() {
    const today = todayStr();
    const active = agendas.filter(a => !a.completed);
    
    // Include task_meeting hybrid in both task tallies and meetings tallies
    const tasks = agendas.filter(a => a.category !== 'meeting'); // task_meeting included here
    const activeTasks = active.filter(a => a.category !== 'meeting'); // task_meeting included here
    
    // Meetings count includes both 'meeting' and hybrid 'task_meeting'
    const activeMeetings = active.filter(a => a.category === 'meeting' || a.category === 'task_meeting');

    document.getElementById('heroTotalAgendas').textContent = tasks.length;
    document.getElementById('heroDueToday').textContent = activeTasks.filter(a => a.date === today).length;
    document.getElementById('heroMeetingsCount').textContent = activeMeetings.length;
    document.getElementById('heroOverdue').textContent = activeTasks.filter(a => a.date < today).length;

    // Crosslink unlogged days logic
    const records = JSON.parse(safeLocalStorage.getItem('p4a_intern_records') || '[]');
    const loggedDates = new Set(records.map(r => r.date));
    
    // Find all unique dates in agendas that are NOT completed and are in the past or today, but have NO record logged
    const unloggedAgendaDates = new Set(
        agendas
            .filter(a => !a.completed && a.date <= today && !loggedDates.has(a.date))
            .map(a => a.date)
    );
    
    const count = unloggedAgendaDates.size;
    const statEl = document.getElementById('heroTrackerStat');
    const badgeEl = document.getElementById('heroUnloggedCount');

    if (count > 0) {
        if (statEl) statEl.style.display = 'block';
        if (badgeEl) badgeEl.textContent = count;
    } else {
        if (statEl) statEl.style.display = 'none';
    }
}

// ==================== TODAY AT A GLANCE ====================

// ==================== NOTIFICATIONS ====================
function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function checkDailyNotifications() {
    const today = todayStr();
    const tomorrow = tomorrowStr();
    const todayItems = agendas.filter(a => !a.completed && a.date === today && a.notif !== false);
    const tomorrowItems = agendas.filter(a => !a.completed && a.date === tomorrow && a.notif !== false);
    const overdueItems = agendas.filter(a => !a.completed && a.date < today && a.notif !== false);

    if ('Notification' in window && Notification.permission === 'granted') {
        if (todayItems.length > 0) {
            new Notification('📋 P4A Agenda – Due Today!', {
                body: `You have ${todayItems.length} agenda item(s) due today: ${todayItems.slice(0,2).map(a => a.title).join(', ')}`,
                icon: ''
            });
        }
        if (tomorrowItems.length > 0) {
            new Notification('🔔 P4A Agenda – Due Tomorrow!', {
                body: `${tomorrowItems.length} item(s) due tomorrow: ${tomorrowItems.slice(0,2).map(a => a.title).join(', ')}`,
                icon: ''
            });
        }
        if (overdueItems.length > 0) {
            new Notification('🚨 P4A Agenda – Overdue Items!', {
                body: `You have ${overdueItems.length} overdue item(s) that need attention.`,
                icon: ''
            });
        }
    }
}

function buildNotifications() {
    const today = todayStr();
    const tomorrow = tomorrowStr();
    const notifList = document.getElementById('notifList');
    const notifCount = document.getElementById('notifCount');

    const overdueItems = agendas.filter(a => !a.completed && a.date < today);
    const todayItems = agendas.filter(a => !a.completed && a.date === today);
    const tomorrowItems = agendas.filter(a => !a.completed && a.date === tomorrow);
    const total = overdueItems.length + todayItems.length + tomorrowItems.length;

    if (total === 0) {
        notifList.innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i> You\'re all caught up! 🎉</div>';
        notifCount.style.display = 'none';
        return;
    }

    notifCount.style.display = 'flex';
    notifCount.textContent = total > 9 ? '9+' : total;

    let html = '';
    overdueItems.forEach(a => {
        html += `<div class="notif-item notif-overdue" onclick="openViewModal('${a.id}')">
            <div class="notif-item-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
            <div class="notif-item-body">
                <div class="notif-item-title">${escHtml(a.title)}</div>
                <div class="notif-item-sub">🚨 Overdue since ${formatDateShort(a.date)}</div>
            </div>
        </div>`;
    });
    todayItems.forEach(a => {
        html += `<div class="notif-item notif-today" onclick="openViewModal('${a.id}')">
            <div class="notif-item-icon"><i class="fa-solid fa-bell"></i></div>
            <div class="notif-item-body">
                <div class="notif-item-title">${escHtml(a.title)}</div>
                <div class="notif-item-sub">📅 Due Today${a.time ? ' at ' + formatTime(a.time) : ''}</div>
            </div>
        </div>`;
    });
    tomorrowItems.forEach(a => {
        html += `<div class="notif-item notif-tomorrow" onclick="openViewModal('${a.id}')">
            <div class="notif-item-icon"><i class="fa-solid fa-clock"></i></div>
            <div class="notif-item-body">
                <div class="notif-item-title">${escHtml(a.title)}</div>
                <div class="notif-item-sub">🔔 Due Tomorrow${a.time ? ' at ' + formatTime(a.time) : ''}</div>
            </div>
        </div>`;
    });

    notifList.innerHTML = html;
    renderHeroStats();
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const overlay = document.getElementById('notifOverlay');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    overlay.style.display = isOpen ? 'none' : 'block';
}

function clearNotifications() {
    document.getElementById('notifList').innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i> No notifications</div>';
    document.getElementById('notifCount').style.display = 'none';
    toggleNotifPanel();
    showToast('Notifications cleared', 'info', 'fa-check');
}

// ==================== CALENDAR ====================
function renderCalendar() {
    const title = document.getElementById('calMonthTitle');
    const grid = document.getElementById('calGrid');
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    title.textContent = `${monthNames[calMonth]} ${calYear}`;

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    const today = todayStr();

    // Filter agendas for this month
    const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
    const filteredIds = getFilteredIds();

    let html = '';
    let totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        let day, dateStr, isOtherMonth = false;
        if (i < firstDay) {
            day = daysInPrevMonth - firstDay + i + 1;
            const m = calMonth === 0 ? 12 : calMonth;
            const y = calMonth === 0 ? calYear - 1 : calYear;
            dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            isOtherMonth = true;
        } else if (i >= firstDay + daysInMonth) {
            day = i - firstDay - daysInMonth + 1;
            const m = calMonth === 11 ? 1 : calMonth + 2;
            const y = calMonth === 11 ? calYear + 1 : calYear;
            dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            isOtherMonth = true;
        } else {
            day = i - firstDay + 1;
            dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        }

        const isToday = dateStr === today;
        const isSelected = dateStr === selectedDateStr;
        const dayAgendas = agendas.filter(a => a.date === dateStr && filteredIds.includes(a.id));
        dayAgendas.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const timeA = a.time || '';
            const timeB = b.time || '';
            if (timeA === timeB) return 0;
            if (!timeA) return -1;
            if (!timeB) return 1;
            return timeA.localeCompare(timeB);
        });

        let classes = 'cal-cell';
        if (isOtherMonth) classes += ' other-month';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';

        const dayNumHtml = isToday
            ? `<div class="cal-day-num" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--p4a-yellow);color:var(--p4a-dark);font-weight:800;">${day}</div>`
            : `<div class="cal-day-num">${day}</div>`;

        let chipsHtml = '';
        const showMax = 2;
        dayAgendas.slice(0, showMax).forEach(ag => {
            const status = getDateStatus(ag.date);
            let chipColor = '';
            if (ag.completed) chipColor = 'background:rgba(39,174,96,0.15);color:#15803d;';
            else if (status === 'overdue') chipColor = 'background:rgba(217,48,37,0.12);color:#dc2626;';
            else chipColor = '';
            chipsHtml += `<div class="cal-agenda-chip chip-${ag.category}" style="${ag.completed ? 'opacity:0.6;' : ''}${chipColor}text-decoration:${ag.completed?'line-through':'none'};" onclick="event.stopPropagation();openViewModal('${ag.id}')">${escHtml(ag.title)}</div>`;
        });
        if (dayAgendas.length > showMax) {
            chipsHtml += `<div class="cal-more">+${dayAgendas.length - showMax} more</div>`;
        }

        html += `<div class="${classes}" onclick="selectDate('${dateStr}')">
            ${dayNumHtml}
            ${chipsHtml}
        </div>`;
    }
    grid.innerHTML = html;

    if (selectedDateStr) {
        renderDayDetail(selectedDateStr);
    }
}

function changeMonth(dir) {
    calMonth += dir;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
}

function goToToday() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    selectedDateStr = todayStr();
    renderCalendar();
}

function selectDate(dateStr) {
    selectedDateStr = dateStr;
    pendingDateStr = dateStr;
    renderCalendar();
    renderDayDetail(dateStr);
    document.getElementById('dayDetailCard').style.display = 'block';
    document.getElementById('dayDetailCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderDayDetail(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const title = d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('dayDetailTitle').textContent = title;

    const dayAgendas = agendas.filter(a => a.date === dateStr);
    dayAgendas.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const timeA = a.time || '';
        const timeB = b.time || '';
        if (timeA === timeB) return 0;
        if (!timeA) return -1;
        if (!timeB) return 1;
        return timeA.localeCompare(timeB);
    });
    const status = getDateStatus(dateStr);
    const statusLabels = { overdue: '🚨 Overdue', today: '📅 Today', tomorrow: '🔔 Tomorrow', upcoming: '📆 Upcoming' };
    document.getElementById('dayDetailSub').textContent = statusLabels[status] || '';

    const listEl = document.getElementById('dayDetailList');
    if (dayAgendas.length === 0) {
        listEl.innerHTML = '<div class="day-detail-empty"><i class="fa-regular fa-calendar-xmark"></i> No agendas for this day.<br><small>Click "Add for this day" to create one!</small></div>';
        return;
    }
    listEl.innerHTML = dayAgendas.map(ag => buildAgendaItemHtml(ag)).join('');
}

// ==================== LIST VIEW ====================
function renderListView() {
    const container = document.getElementById('listContainer');
    const query = document.getElementById('searchAgenda').value.toLowerCase();
    const priFilter = document.getElementById('filterPriority').value;
    const catFilter = document.getElementById('filterCategory').value;
    const sort = document.getElementById('sortAgenda').value;

    let filtered = agendas.filter(a => {
        const matchQ = !query || a.title.toLowerCase().includes(query) || (a.desc || '').toLowerCase().includes(query);
        const matchPri = !priFilter || a.priority === priFilter;
        const matchCat = !catFilter || a.category === catFilter;
        return matchQ && matchPri && matchCat;
    });

    if (sort === 'date') filtered.sort((a, b) => (a.date > b.date ? 1 : -1));
    else if (sort === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => order[a.priority] - order[b.priority]);
    }
    else if (sort === 'category') filtered.sort((a, b) => a.category.localeCompare(b.category));
    else if (sort === 'status') {
        const ord = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3 };
        filtered.sort((a, b) => ord[getDateStatus(a.date)] - ord[getDateStatus(b.date)]);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <div class="empty-state-icon"><i class="fa-regular fa-folder-open"></i></div>
                <h4 class="empty-state-title">No agendas found${query ? ` for "${query}"` : ''}</h4>
                <p class="empty-state-sub">Start adding your internship tasks, meetings, and deadlines!</p>
                <button class="empty-state-btn" onclick="openAddModal()">
                    <i class="fa-solid fa-plus"></i> Add Agenda
                </button>
            </div>`;
        return;
    }

    // Group by status
    const groups = { overdue: [], today: [], tomorrow: [], upcoming: [], done: [] };
    filtered.forEach(a => {
        if (a.completed) groups.done.push(a);
        else groups[getDateStatus(a.date)].push(a);
    });

    const groupLabels = {
        overdue: '🚨 Overdue',
        today: '📅 Due Today',
        tomorrow: '🔔 Due Tomorrow',
        upcoming: '📆 Upcoming',
        done: '✅ Completed'
    };

    let html = '';
    for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        if (sort === 'date' || sort === 'status') {
            items.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                const timeA = a.time || '';
                const timeB = b.time || '';
                if (timeA === timeB) return 0;
                if (!timeA) return -1;
                if (!timeB) return 1;
                return timeA.localeCompare(timeB);
            });
        }
        html += `<div class="list-group-label">${groupLabels[key]} (${items.length})</div>`;
        html += items.map(ag => buildAgendaItemHtml(ag)).join('');
    }
    container.innerHTML = html;
}

// ==================== UPCOMING VIEW ====================
function renderUpcomingView() {
    const container = document.getElementById('upcomingContainer');
    const query = document.getElementById('searchAgenda').value.toLowerCase();
    const priFilter = document.getElementById('filterPriority').value;
    const catFilter = document.getElementById('filterCategory').value;

    const today = todayStr();
    let filtered = agendas.filter(a => {
        if (a.completed) return false;
        const matchQ = !query || a.title.toLowerCase().includes(query) || (a.desc || '').toLowerCase().includes(query);
        const matchPri = !priFilter || a.priority === priFilter;
        const matchCat = !catFilter || a.category === catFilter;
        return matchQ && matchPri && matchCat;
    });

    filtered.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const timeA = a.time || '';
        const timeB = b.time || '';
        if (timeA === timeB) return 0;
        if (!timeA) return -1;
        if (!timeB) return 1;
        return timeA.localeCompare(timeB);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <div class="empty-state-icon"><i class="fa-regular fa-calendar-check"></i></div>
                <h4 class="empty-state-title">You're all caught up! 🎉</h4>
                <p class="empty-state-sub">No upcoming agendas. Add something to keep track of!</p>
                <button class="empty-state-btn" onclick="openAddModal()">
                    <i class="fa-solid fa-plus"></i> Add Agenda
                </button>
            </div>`;
        return;
    }

    // Group by date
    const byDate = {};
    filtered.forEach(a => {
        if (!byDate[a.date]) byDate[a.date] = [];
        byDate[a.date].push(a);
    });

    const monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let html = '';
    for (const [dateStr, items] of Object.entries(byDate)) {
        const d = new Date(dateStr + 'T00:00:00');
        const dayNum = d.getDate();
        const monthA = monthAbbr[d.getMonth()];
        const weekday = d.toLocaleDateString('en-PH', { weekday: 'long' });
        const status = getDateStatus(dateStr);
        let labelTag = '';
        if (status === 'today') labelTag = '<span class="today-tag">Today</span>';
        else if (status === 'tomorrow') labelTag = '<span class="tomorrow-tag">Tomorrow</span>';
        else if (status === 'overdue') labelTag = '<span style="color:var(--danger);font-weight:700;">Overdue!</span>';

        html += `<div class="upcoming-group-card">
            <div class="upcoming-group-header">
                <div class="upcoming-group-date-badge">
                    <span class="day-num">${dayNum}</span>
                    <span class="month-abbr">${monthA}</span>
                </div>
                <div class="upcoming-group-info">
                    <h4>${weekday} ${labelTag}</h4>
                    <span>${items.length} agenda${items.length > 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="upcoming-items">
                ${items.map(ag => buildAgendaItemHtml(ag)).join('')}
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

// ==================== BUILD AGENDA ITEM HTML ====================
function buildAgendaItemHtml(ag) {
    const status = ag.completed ? 'done' : getDateStatus(ag.date);
    let itemClass = `agenda-item pri-${ag.priority}`;
    if (ag.completed) itemClass += ' completed';
    else if (status === 'overdue') itemClass += ' overdue';
    else if (status === 'today') itemClass += ' due-today';

    const checkIcon = ag.completed ? '<i class="fa-solid fa-check"></i>' : '';
    const timeDisplay = ag.time ? `<span class="ag-meta-item"><i class="fa-solid fa-clock"></i>${formatTime(ag.time)}</span>` : '';
    const locationDisplay = ag.location ? `<span class="ag-meta-item"><i class="fa-solid fa-location-dot"></i>${escHtml(ag.location)}</span>` : '';

    let tags = '';
    if (!ag.completed) {
        if (status === 'overdue') tags += '<span class="ag-tag tag-overdue">Overdue</span>';
        else if (status === 'today') tags += '<span class="ag-tag tag-today">Today</span>';
        else if (status === 'tomorrow') tags += '<span class="ag-tag tag-tomorrow">Tomorrow</span>';
    } else {
        tags += '<span class="ag-tag tag-done">Done</span>';
    }

    let recurringLabel = '';
    if (ag.repeat && ag.repeat !== 'none') {
        recurringLabel = ` <span class="recurring-badge" title="Recurring Event"><i class="fa-solid fa-arrows-rotate"></i> Repeat</span>`;
    }

    return `<div class="${itemClass}" onclick="openViewModal('${ag.id}')">
        <div class="ag-check" onclick="event.stopPropagation();toggleComplete('${ag.id}')" title="${ag.completed ? 'Mark incomplete' : 'Mark complete'}">${checkIcon}</div>
        <div class="ag-body">
            <div class="ag-title">${escHtml(ag.title)}${recurringLabel}</div>
            <div class="ag-meta">
                <span class="ag-meta-item"><i class="fa-regular fa-calendar"></i>${formatDateShort(ag.date)}</span>
                ${timeDisplay}
                ${locationDisplay}
                <span class="cat-badge ${ag.category}">${getCatLabel(ag.category)}</span>
                <span class="priority-badge ${ag.priority}">${getPriLabel(ag.priority)}</span>
            </div>
            ${tags ? `<div class="ag-tags">${tags}</div>` : ''}
        </div>
        <div class="ag-actions">
            ${(!ag.completed) ? `<button class="ag-action-btn move" onclick="event.stopPropagation();openMoveModal('${ag.id}')" title="Move to another day"><i class="fa-solid fa-share"></i></button>` : ''}
            <button class="ag-action-btn edit" onclick="event.stopPropagation();openEditModal('${ag.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="ag-action-btn del" onclick="event.stopPropagation();openDeleteModal('${ag.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    </div>`;
}

// ==================== FILTER HELPER ====================
function getFilteredIds() {
    const query = document.getElementById('searchAgenda').value.toLowerCase();
    const priFilter = document.getElementById('filterPriority').value;
    const catFilter = document.getElementById('filterCategory').value;
    return agendas.filter(a => {
        const matchQ = !query || a.title.toLowerCase().includes(query);
        const matchPri = !priFilter || a.priority === priFilter;
        const matchCat = !catFilter || a.category === catFilter;
        return matchQ && matchPri && matchCat;
    }).map(a => a.id);
}

// ==================== VIEW SWITCHING ====================
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`view-${view}`).style.display = 'block';
    document.getElementById(`tab-${view}`).classList.add('active');
    renderCurrentView();
}

function renderCurrentView() {
    if (currentView === 'calendar') renderCalendar();
    else if (currentView === 'list') renderListView();
    else if (currentView === 'upcoming') renderUpcomingView();
}

// ==================== ADD / EDIT MODAL ====================
function openAddModal() {
    clearModalFields();
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Add Agenda';
    document.getElementById('modalSaveLabel').textContent = 'Save Agenda';
    document.getElementById('agEditId').value = '';
    document.getElementById('agDate').value = formatDateInput(new Date());
    document.getElementById('agendaModal').style.display = 'flex';
}

function openAddModalForDate() {
    if (!pendingDateStr) return openAddModal();
    clearModalFields();
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Add Agenda';
    document.getElementById('modalSaveLabel').textContent = 'Save Agenda';
    document.getElementById('agEditId').value = '';
    document.getElementById('agDate').value = pendingDateStr;
    document.getElementById('agendaModal').style.display = 'flex';
}

function openEditModal(id) {
    const ag = agendas.find(a => a.id === id);
    if (!ag) return;
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Edit Agenda';
    document.getElementById('modalSaveLabel').textContent = 'Save Changes';
    document.getElementById('agTitle').value = ag.title || '';
    document.getElementById('agDate').value = ag.date || '';
    document.getElementById('agTime').value = ag.time || '';
    document.getElementById('agCategory').value = ag.category || 'task';
    document.getElementById('agPriority').value = ag.priority || 'medium';
    document.getElementById('agDesc').value = ag.desc || '';
    document.getElementById('agLocation').value = ag.location || '';
    document.getElementById('agNotif').checked = ag.notif !== false;
    document.getElementById('agRepeat').value = ag.repeat || 'none';
    document.getElementById('agEditId').value = id;
    document.getElementById('agendaModal').style.display = 'flex';
    closeViewModal();
}

function closeAgendaModal() {
    document.getElementById('agendaModal').style.display = 'none';
    clearModalFields();
}

function clearModalFields() {
    document.getElementById('agTitle').value = '';
    document.getElementById('agDate').value = formatDateInput(new Date());
    document.getElementById('agTime').value = '';
    document.getElementById('agCategory').value = 'task';
    document.getElementById('agPriority').value = 'medium';
    document.getElementById('agDesc').value = '';
    document.getElementById('agLocation').value = '';
    document.getElementById('agNotif').checked = true;
    document.getElementById('agRepeat').value = 'none';
    document.getElementById('agEditId').value = '';
}

function saveAgenda() {
    const title = document.getElementById('agTitle').value.trim();
    const date = document.getElementById('agDate').value;
    if (!title) { showToast('Please enter a title!', 'error', 'fa-triangle-exclamation'); return; }
    if (!date) { showToast('Please select a date!', 'error', 'fa-triangle-exclamation'); return; }

    const data = {
        title,
        date,
        time: document.getElementById('agTime').value,
        category: document.getElementById('agCategory').value,
        priority: document.getElementById('agPriority').value,
        desc: document.getElementById('agDesc').value.trim(),
        location: document.getElementById('agLocation').value.trim(),
        notif: document.getElementById('agNotif').checked,
        repeat: document.getElementById('agRepeat').value
    };

    const editId = document.getElementById('agEditId').value;
    lastAddedIds = []; // Reset tracked action
    if (editId) {
        const idx = agendas.findIndex(a => a.id === editId);
        if (idx > -1) {
            agendas[idx] = { ...agendas[idx], ...data };
            showToast('Agenda updated!', 'success', 'fa-check');
        }
    } else {
        // Create repeating series if selected
        const repeatVal = data.repeat;
        if (repeatVal && repeatVal !== 'none') {
            // Parse date manually to avoid timezone offsets shifting it
            const [yr, mo, dy] = data.date.split('-').map(Number);
            const startD = new Date(yr, mo - 1, dy);
            const occurrences = 8;
            
            // Check if weekday-specific repeat is selected
            const weekdays = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
            const targetDay = weekdays[repeatVal];

            if (targetDay !== undefined) {
                // Find first occurrence on or after startD that matches targetDay
                const diff = (targetDay - startD.getDay() + 7) % 7;
                startD.setDate(startD.getDate() + diff);
            }

            const stepDays = 7; 
            const seriesId = genId(); // Shared series identifier

            for (let i = 0; i < occurrences; i++) {
                const currentD = new Date(startD.getTime());
                currentD.setDate(startD.getDate() + (i * stepDays));
                const formattedDStr = formatDateInput(currentD);
                const titleSfx = ` (Occurrence ${i+1}/${occurrences})`;
                const newId = genId();
                lastAddedIds.push(newId);
                agendas.push({
                    id: newId,
                    seriesId: seriesId,
                    completed: false,
                    createdAt: new Date().toISOString(),
                    ...data,
                    title: data.title + (i > 0 ? titleSfx : ''),
                    date: formattedDStr
                });
            }
            showToast(`Agenda created with ${occurrences} recurring instances! <a href="#" onclick="event.preventDefault(); undoLastAdd();" style="color:#fff;text-decoration:underline;margin-left:8px;font-weight:700;">Undone</a>`, 'success', 'fa-rotate-left');
        } else {
            const newId = genId();
            lastAddedIds.push(newId);
            agendas.push({ id: newId, completed: false, createdAt: new Date().toISOString(), ...data });
            showToast(`Agenda added! <a href="#" onclick="event.preventDefault(); undoLastAdd();" style="color:#fff;text-decoration:underline;margin-left:8px;font-weight:700;">Undone</a>`, 'success', 'fa-rotate-left');
        }
    }

    saveData();
    closeAgendaModal();
    renderCurrentView();
    buildNotifications();
    renderHeroStats();
    if (typeof updateTodayGlance === 'function') updateTodayGlance();
}

// ==================== COMPLETE TOGGLE ====================
function toggleComplete(id) {
    const ag = agendas.find(a => a.id === id);
    if (!ag) return;
    ag.completed = !ag.completed;
    saveData();
    renderCurrentView();
    buildNotifications();
    renderHeroStats();
    updateTodayGlance();
    showToast(ag.completed ? 'Marked as done! ✅' : 'Marked as incomplete', ag.completed ? 'success' : 'info', ag.completed ? 'fa-check-circle' : 'fa-rotate-left');
}

// ==================== VIEW MODAL ====================
function openViewModal(id) {
    const ag = agendas.find(a => a.id === id);
    if (!ag) return;

    document.getElementById('viewModalId').value = id;
    document.getElementById('viewModalTitle').textContent = ag.title;
    document.getElementById('viewModalCat').innerHTML = `<span class="cat-badge ${ag.category}">${getCatLabel(ag.category)}</span><span class="priority-badge ${ag.priority}" style="margin-left:6px;">${getPriLabel(ag.priority)}</span>`;

    const status = ag.completed ? '✅ Completed' : { overdue: '🚨 Overdue', today: '📅 Due Today', tomorrow: '🔔 Due Tomorrow', upcoming: '📆 Upcoming' }[getDateStatus(ag.date)] || '';
    let metaHtml = `<div class="view-meta-item"><i class="fa-regular fa-calendar"></i>${formatDateDisplay(ag.date)}</div>`;
    if (ag.time) metaHtml += `<div class="view-meta-item"><i class="fa-solid fa-clock"></i>${formatTime(ag.time)}</div>`;
    metaHtml += `<div class="view-meta-item"><i class="fa-solid fa-circle-info"></i>${status}</div>`;
    document.getElementById('viewModalMeta').innerHTML = metaHtml;

    const descEl = document.getElementById('viewModalDesc');
    descEl.style.display = ag.desc ? 'block' : 'none';
    descEl.textContent = ag.desc || '';

    const locEl = document.getElementById('viewModalLocation');
    if (ag.location) {
        locEl.style.display = 'flex';
        locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i><span>${escHtml(ag.location)}</span>`;
    } else {
        locEl.style.display = 'none';
    }

    document.getElementById('viewDeleteBtn').onclick = () => { closeViewModal(); openDeleteModal(id); };

    // Show/hide Move to Next Day based on completion status
    const moveBtnEl = document.getElementById('viewMoveBtn');
    if (moveBtnEl) moveBtnEl.style.display = ag.completed ? 'none' : 'inline-flex';

    document.getElementById('viewModal').style.display = 'flex';
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
}

function openMoveModalFromView() {
    const id = document.getElementById('viewModalId').value;
    closeViewModal();
    openMoveModal(id);
}

// ==================== MOVE TO DATE ====================
function openMoveModal(id) {
    const ag = agendas.find(a => a.id === id);
    if (!ag || ag.completed) {
        showToast('Cannot move a completed agenda.', 'warning', 'fa-triangle-exclamation');
        return;
    }

    document.getElementById('moveTargetId').value = id;
    document.getElementById('movingAgendaTitle').innerHTML =
        `Moving: <strong>${escHtml(ag.title)}</strong><br><span style="font-size:0.78rem;color:var(--gray-500);">Currently on ${formatDateShort(ag.date)}</span>`;

    // Default the date picker to tomorrow
    const tomorrow = new Date(ag.date + 'T00:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('moveTargetDate').value = formatDateInput(tomorrow);
    document.getElementById('moveTargetDate').min = todayStr();

    document.getElementById('moveModal').style.display = 'flex';
}

function closeMoveModal() {
    document.getElementById('moveModal').style.display = 'none';
}

// Quick shortcut buttons: set the date input to N days from today
function setMoveDate(daysFromToday) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    document.getElementById('moveTargetDate').value = formatDateInput(d);
}

function confirmMoveAgenda() {
    const id = document.getElementById('moveTargetId').value;
    const newDateStr = document.getElementById('moveTargetDate').value;

    if (!newDateStr) {
        showToast('Please select a date.', 'warning', 'fa-triangle-exclamation');
        return;
    }

    const idx = agendas.findIndex(a => a.id === id);
    if (idx === -1) return;

    const ag = agendas[idx];
    const oldDate = ag.date;
    agendas[idx] = { ...ag, date: newDateStr };
    saveData();
    closeMoveModal();
    renderCurrentView();
    buildNotifications();
    renderHeroStats();

    const newDateDisplay = new Date(newDateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    showToast(`"${ag.title}" moved to ${newDateDisplay}`, 'success', 'fa-calendar-check');
}

function editFromView() {
    const id = document.getElementById('viewModalId').value;
    openEditModal(id);
}

// ==================== DELETE ====================
function openDeleteModal(id) {
    const ag = agendas.find(a => a.id === id);
    document.getElementById('deleteTargetId').value = id;
    
    const modalTitle = document.querySelector('#deleteModal h3');
    const modalText = document.querySelector('#deleteModal p');
    const modalActions = document.querySelector('#deleteModal .modal-actions');

    if (ag && ag.seriesId) {
        modalTitle.textContent = 'Delete Recurring Agenda?';
        modalText.textContent = 'This is part of a recurring series. Do you want to delete only this occurrence, or the entire series?';
        modalActions.innerHTML = `
            <button class="btn btn-outline" onclick="closeDeleteModal()">Cancel</button>
            <button class="btn btn-danger-outline" onclick="confirmDelete(false)">Delete This One</button>
            <button class="btn btn-danger" onclick="confirmDelete(true)">Delete Series</button>
        `;
    } else {
        modalTitle.textContent = 'Delete Agenda?';
        modalText.textContent = 'This cannot be undone. Are you sure?';
        modalActions.innerHTML = `
            <button class="btn btn-outline" onclick="closeDeleteModal()">Cancel</button>
            <button class="btn btn-danger" onclick="confirmDelete(false)">Delete</button>
        `;
    }

    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete(deleteAllSeries = false) {
    const id = document.getElementById('deleteTargetId').value;
    const ag = agendas.find(a => a.id === id);

    if (deleteAllSeries && ag && ag.seriesId) {
        agendas = agendas.filter(a => a.seriesId !== ag.seriesId);
        showToast('Entire recurring series deleted.', 'info', 'fa-trash');
    } else {
        agendas = agendas.filter(a => a.id !== id);
        showToast('Agenda deleted.', 'info', 'fa-trash');
    }

    saveData();
    closeDeleteModal();
    renderCurrentView();
    buildNotifications();
    renderHeroStats();
}

// ==================== TOAST ====================
function showToast(msg, type = 'success', icon = 'fa-check') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3700);
}

// ==================== MOBILE NAV ====================
function toggleMobileNav() {
    document.getElementById('mobileNav').classList.toggle('open');
}

// ==================== PARTICLES ====================
function spawnParticles() {
    const container = document.getElementById('heroParticles');
    for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        p.className = 'hero-particle';
        const size = Math.random() * 12 + 4;
        p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;bottom:0;animation-duration:${Math.random() * 8 + 6}s;animation-delay:${Math.random() * 8}s;`;
        container.appendChild(p);
    }
}

// ==================== ESCAPE HTML ====================
function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== UNDO ACTION ====================
function undoLastAdd() {
    if (!lastAddedIds || lastAddedIds.length === 0) return;
    agendas = agendas.filter(a => !lastAddedIds.includes(a.id));
    lastAddedIds = [];
    saveData();
    renderCurrentView();
    buildNotifications();
    renderHeroStats();
    showToast('Action reverted successfully.', 'info', 'fa-rotate-left');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeAgendaModal();
        closeDeleteModal();
        closeViewModal();
    }
});
