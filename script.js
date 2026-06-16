/* ====================================================
   POWER 4 ALL - Internship Hours Tracker
   JavaScript — Full Feature App Logic
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

// ==================== APP STATE ====================
const REQUIRED_HOURS = 240;
const LUNCH_BREAK_MINS = 60; // 1-hour lunch break deducted daily (not counted toward 240hrs)
const STORAGE_KEY = 'p4a_intern_records';
const INTERN_NAME_KEY = 'p4a_intern_name';
const INTERN_DEPT_KEY = 'p4a_intern_dept';
const INTERN_SCHOOL_KEY = 'p4a_intern_school';
const INTERN_ID_KEY = 'p4a_intern_id';
const TODO_KEY = 'p4a_intern_todos';
const ACHIEVEMENTS_KEY = 'p4a_intern_achievements';

const ACHIEVEMENTS_LIST = [
    { id: 'first_log', title: 'First Steps', desc: 'Log your very first hours.', icon: 'fa-solid fa-shoe-prints' },
    { id: 'tasks_10', title: 'Task Master', desc: 'Complete 10 To-Do tasks.', icon: 'fa-solid fa-list-check' },
    { id: 'days_7', title: 'Dedicated', desc: 'Log attendance for 7 unique days.', icon: 'fa-solid fa-calendar-week' },
    { id: 'hours_50', title: 'Half Century', desc: 'Reach 50 logged hours.', icon: 'fa-solid fa-hourglass-half' },
    { id: 'hours_100', title: 'Century Club', desc: 'Reach 100 logged hours.', icon: 'fa-solid fa-100' },
    { id: 'hours_240', title: 'Finish Line', desc: 'Complete the 240 hours requirement!', icon: 'fa-solid fa-graduation-cap' }
];

let records = [];
let selectedMood = 0;
let editSelectedMood = 0;
let deleteTargetIndex = null;
let unlockedAchievements = [];

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    loadRecords();
    loadProfile();
    setDefaultDates();
    setCurrentDate();
    updateAllUI();
    buildHeroParticles();
    renderLearningsLog();
    setupTimePickers();
    setupMoodButtons();
    setupMenuToggle();
    setupNavLinks();
    loadTodos();
    renderTodoList();
    loadAchievements();
    checkAchievements();
});

// ==================== DATA PERSISTENCE ====================
function loadRecords() {
    try {
        const stored = safeLocalStorage.getItem(STORAGE_KEY);
        records = stored ? JSON.parse(stored) : [];
    } catch (e) {
        records = [];
    }
}

function saveRecords() {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    if (typeof checkAchievements === 'function') checkAchievements();
}

// ==================== PROFILE MANAGEMENT ====================
function loadProfile() {
    const name = safeLocalStorage.getItem(INTERN_NAME_KEY) || 'Nica Desacola';
    const dept = safeLocalStorage.getItem(INTERN_DEPT_KEY) || 'Engineering';
    const school = safeLocalStorage.getItem(INTERN_SCHOOL_KEY) || 'University of Manila';
    const internId = safeLocalStorage.getItem(INTERN_ID_KEY) || 'P4A-2026-001';

    // Set form fields
    const nameInput = document.getElementById('profName');
    const deptInput = document.getElementById('profDeptInput');
    const schoolInput = document.getElementById('profSchool');
    const idInput = document.getElementById('profId');

    if (nameInput) nameInput.value = name;
    if (deptInput) deptInput.value = dept;
    if (schoolInput) schoolInput.value = school;
    if (idInput) idInput.value = internId;

    // Set view elements
    const dispName = document.getElementById('profDispName');
    const dispDept = document.getElementById('profDispDept');
    const dispSchool = document.getElementById('profDispSchool');
    const dispId = document.getElementById('profDispId');

    if (dispName) dispName.textContent = name;
    if (dispDept) dispDept.innerHTML = `<i class="fa-solid fa-building"></i> ${dept}`;
    if (dispSchool) dispSchool.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${school}`;
    if (dispId) dispId.innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${internId}`;

    // Avatar initials
    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatar.textContent = initials || 'ND';
    }

    // Set Welcome back name in Hero
    const heroName = document.getElementById('heroInternName');
    if (heroName) {
        heroName.textContent = name.split(' ')[0];
    }
}

function saveProfile() {
    const name = document.getElementById('profName').value.trim();
    const dept = document.getElementById('profDeptInput').value;
    const school = document.getElementById('profSchool').value.trim();
    const internId = document.getElementById('profId').value.trim();

    if (!name) { showToast('Name is required.', 'error'); return; }

    safeLocalStorage.setItem(INTERN_NAME_KEY, name);
    safeLocalStorage.setItem(INTERN_DEPT_KEY, dept);
    safeLocalStorage.setItem(INTERN_SCHOOL_KEY, school);
    safeLocalStorage.setItem(INTERN_ID_KEY, internId);

    loadProfile();
    toggleProfileEdit(false);
    showToast('✅ Profile updated successfully!', 'success');
}

function toggleProfileEdit(show = null) {
    const view = document.getElementById('profileViewMode');
    const edit = document.getElementById('profileEditMode');
    const btn = document.getElementById('editProfileBtn');

    if (!view || !edit || !btn) return;

    const isEditing = show !== null ? show : edit.style.display === 'none';

    if (isEditing) {
        view.style.display = 'none';
        edit.style.display = 'flex';
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        btn.classList.add('icon-btn-delete');
        btn.classList.remove('icon-btn-edit');
        btn.title = "Cancel Edit";
    } else {
        view.style.display = 'flex';
        edit.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        btn.classList.add('icon-btn-edit');
        btn.classList.remove('icon-btn-delete');
        btn.title = "Edit Profile";
    }
}

function cancelProfileEdit() {
    loadProfile();
    toggleProfileEdit(false);
}

// ==================== HELPERS ====================
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToHM(mins) {
    if (mins < 0) mins = 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function minutesToDecimalHours(mins) {
    return Math.round(mins / 60 * 100) / 100;
}

function calcDuration(timeIn, timeOut) {
    // Returns NET minutes (gross time minus 1-hour lunch break)
    const inM = toMinutes(timeIn);
    const outM = toMinutes(timeOut);
    if (!inM && !outM) return 0;
    const gross = Math.max(0, outM - inM);
    return Math.max(0, gross - LUNCH_BREAK_MINS);
}

function calcGrossDuration(timeIn, timeOut) {
    // Returns GROSS minutes (raw time difference, no deduction)
    const inM = toMinutes(timeIn);
    const outM = toMinutes(timeOut);
    if (!inM && !outM) return 0;
    return Math.max(0, outM - inM);
}

function getTotalMinutes() {
    return records.reduce((sum, r) => sum + (r.durationMins || 0), 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function moodEmoji(mood) {
    const emojis = { 1: '😞', 2: '😐', 3: '🙂', 4: '😊', 5: '🌟' };
    return emojis[mood] || '—';
}

function getProgressBadge(pct) {
    if (pct === 0) return { icon: 'fa-seedling', text: 'Just Starting', color: '' };
    if (pct < 25) return { icon: 'fa-fire', text: 'Getting Started', color: '' };
    if (pct < 50) return { icon: 'fa-bolt', text: 'Making Progress', color: '' };
    if (pct < 75) return { icon: 'fa-star-half-stroke', text: 'Halfway There!', color: '' };
    if (pct < 100) return { icon: 'fa-rocket', text: 'Almost Done!', color: '' };
    return { icon: 'fa-trophy', text: 'Completed! 🎉', color: '' };
}

// ==================== SETUP ====================
function setDefaultDates() {
    const today = formatLocalDate(new Date());
    const logDate = document.getElementById('logDate');
    if (logDate) logDate.value = today;
}

function setCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) {
        const d = new Date();
        el.textContent = d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}

function setupTimePickers() {
    const logIn = document.getElementById('logTimeIn');
    const logOut = document.getElementById('logTimeOut');
    if (logIn) logIn.addEventListener('change', updateDurationPreview);
    if (logOut) logOut.addEventListener('change', updateDurationPreview);
}

function updateDurationPreview() {
    const timeIn = document.getElementById('logTimeIn').value;
    const timeOut = document.getElementById('logTimeOut').value;
    const preview = document.getElementById('durationPreview');
    const text = document.getElementById('durationText');

    if (timeIn && timeOut) {
        const gross = calcGrossDuration(timeIn, timeOut);
        const net = calcDuration(timeIn, timeOut);
        if (gross > 0) {
            preview.style.display = 'flex';
            text.innerHTML = `<span class="dur-net">${minutesToHM(net)}</span> <span class="dur-breakdown">(${minutesToHM(gross)} &minus; 1h lunch)</span>`;
        } else {
            preview.style.display = 'none';
        }
    } else {
        preview.style.display = 'none';
    }
}

function setupMoodButtons() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMood = parseInt(btn.dataset.mood);
        });
    });
}

function setupMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const mobileNav = document.getElementById('mobileNav');
    if (toggle && mobileNav) {
        toggle.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
            const icon = toggle.querySelector('i');
            icon.className = mobileNav.classList.contains('open') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        });
    }
}

function closeMobileNav() {
    const mobileNav = document.getElementById('mobileNav');
    const toggle = document.getElementById('menuToggle');
    if (mobileNav) mobileNav.classList.remove('open');
    if (toggle) toggle.querySelector('i').className = 'fa-solid fa-bars';
}

function setupNavLinks() {
    // Prevent default anchor behavior
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === '#dashboard' ||
                link.getAttribute('href') === '#log-hours' ||
                link.getAttribute('href') === '#records' ||
                link.getAttribute('href') === '#reports' ||
                link.getAttribute('href') === '#todo') {
                e.preventDefault();
            }
        });
    });
}

// ==================== NAVIGATION ====================
function showSection(name) {
    // Hide all
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.header-nav .nav-link').forEach(l => l.classList.remove('active'));

    // Show target
    const section = document.getElementById(`section-${name}`);
    if (section) section.classList.add('active');

    const navLink = document.getElementById(`nav-${name}`);
    if (navLink) navLink.classList.add('active');

    // Scroll to top of main
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh charts if reports
    if (name === 'reports') {
        setTimeout(() => {
            buildWeeklyChart();
            buildRatingChart();
            updateDonutChart();
            updateReportSummary();
        }, 50);
    }

    if (name === 'records') {
        renderRecordsTable();
    }
}


// ==================== LOG FORM ====================
function saveLogEntry() {
    const date = document.getElementById('logDate').value;
    const timeIn = document.getElementById('logTimeIn').value;
    const timeOut = document.getElementById('logTimeOut').value;
    const task = document.getElementById('logTask').value.trim();
    const dept = document.getElementById('logDept').value;
    const learning = document.getElementById('logLearning').value.trim();
    const type = document.getElementById('logType').value;

    if (!date) { showToast('Please select a date.', 'error'); return; }
    if (!timeIn || !timeOut) { showToast('Please enter time in and time out.', 'error'); return; }
    if (!task) { showToast('Please describe your task or activity.', 'error'); return; }

    const grossMins = calcGrossDuration(timeIn, timeOut);
    const durationMins = calcDuration(timeIn, timeOut);
    if (grossMins <= LUNCH_BREAK_MINS) { showToast('Work hours must be more than 1 hour (lunch break).', 'error'); return; }

    const entry = {
        id: Date.now(),
        date,
        timeIn,
        timeOut,
        grossMins,
        durationMins,
        task,
        dept,
        learning,
        mood: selectedMood,
        type
    };

    records.push(entry);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveRecords();
    updateAllUI();
    clearLogForm();

    showToast(`✅ ${minutesToHM(durationMins)} logged for ${formatDate(date)}!`, 'success');
    // Navigate to records so user sees their new entry immediately
    setTimeout(() => showSection('records'), 600);
}

function clearLogForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('logDate').value = today;
    document.getElementById('logTimeIn').value = '';
    document.getElementById('logTimeOut').value = '';
    document.getElementById('logTask').value = '';
    document.getElementById('logDept').value = '';
    document.getElementById('logLearning').value = '';
    document.getElementById('logType').value = 'regular';
    document.getElementById('durationPreview').style.display = 'none';
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    selectedMood = 0;
}

// ==================== UPDATE ALL UI ====================
function updateAllUI() {
    const totalMins = getTotalMinutes();
    const totalHours = totalMins / 60;
    const remainingMins = Math.max(0, REQUIRED_HOURS * 60 - totalMins);
    const pct = Math.min(100, Math.round((totalHours / REQUIRED_HOURS) * 100));
    const daysAttended = records.length;
    const avgMins = daysAttended > 0 ? Math.round(totalMins / daysAttended) : 0;

    // Stats
    setEl('statTotal', minutesToHM(totalMins));
    setEl('statRemaining', minutesToHM(remainingMins));
    setEl('statDays', daysAttended);
    setEl('statAvg', minutesToHM(avgMins));

    // Streak counter
    updateStreakCounter();

    // Progress bar
    const fill = document.getElementById('mainProgressFill');
    if (fill) fill.style.width = `${pct}%`;
    setEl('progressHours', totalHours.toFixed(1));
    setEl('progressPercent', `${pct}%`);

    // Progress badge
    const badge = getProgressBadge(pct);
    const badgeEl = document.getElementById('progressBadge');
    if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid ${badge.icon}"></i> ${badge.text}`;

    // Hero ring
    const ringFill = document.getElementById('heroRingFill');
    if (ringFill) {
        const circumference = 2 * Math.PI * 80;
        const offset = circumference - (pct / 100) * circumference;
        ringFill.style.strokeDasharray = circumference;
        ringFill.style.strokeDashoffset = offset;
    }
    setEl('heroPercent', `${pct}%`);

    // Info panel
    setEl('infoLogged', `${totalHours.toFixed(1)} hrs`);
    setEl('infoRemaining', `${(remainingMins / 60).toFixed(1)} hrs`);

    // Estimate
    updateEstimate(totalMins, avgMins);

    // Allowance tracker & motivation panel
    updateAllowanceTracker(totalMins, avgMins, remainingMins, pct, daysAttended);

    // Recent activity
    renderRecentActivity();

    // Render Task & Learning Log
    renderLearningsLog();

    // Records table if active
    if (document.getElementById('section-records').classList.contains('active')) {
        renderRecordsTable();
    }
}

function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ==================== STREAK COUNTER ====================
function updateStreakCounter() {
    return;
}

// ==================== OPTIONAL FIELDS TOGGLE ====================
function toggleOptionalFields() {
    const fields = document.getElementById('optionalFields');
    const btn = document.getElementById('optionalToggle');
    const isOpen = fields.style.display !== 'none';
    fields.style.display = isOpen ? 'none' : 'flex';
    btn.classList.toggle('open', !isOpen);
}

// ==================== SORT RECORDS ====================
let sortState = { col: 'date', dir: 'desc' };

function sortRecords(col) {
    if (sortState.col === col) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.col = col;
        sortState.dir = col === 'date' ? 'desc' : 'desc';
    }

    // Reset all sort icons
    ['date', 'duration', 'rating'].forEach(c => {
        const icon = document.getElementById(`sort-${c}`);
        if (icon) {
            icon.className = 'fa-solid fa-sort sort-icon';
            icon.classList.remove('active');
        }
    });

    // Set active icon
    const activeIcon = document.getElementById(`sort-${col}`);
    if (activeIcon) {
        activeIcon.className = `fa-solid fa-sort-${sortState.dir === 'asc' ? 'up' : 'down'} sort-icon active`;
    }

    // Sort the global records array in-place, then re-render with current search filter
    records.sort((a, b) => {
        let valA, valB;
        if (col === 'date') {
            valA = new Date(a.date); valB = new Date(b.date);
        } else if (col === 'duration') {
            valA = a.durationMins; valB = b.durationMins;
        } else if (col === 'rating') {
            valA = a.mood || 0; valB = b.mood || 0;
        }
        return sortState.dir === 'asc' ? valA - valB : valB - valA;
    });

    const currentFilter = document.getElementById('searchRecords')?.value || '';
    renderRecordsTable(currentFilter);
}

// ==================== ALLOWANCE & MOTIVATION TRACKER ====================
const ALLOWANCE_PER_DAY = 350;          // ₱ per day attended
const AVG_HOURS_FALLBACK = 8;           // assumed hours/day when no data yet

const MOTIVATIONAL_QUOTES = [
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Every day is a new beginning. Take a deep breath, smile, and start again.", author: "Unknown" },
    { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
    { text: "Great things never come from comfort zones.", author: "Neil Strauss" },
    { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
    { text: "If you can dream it, you can achieve it.", author: "Walt Disney" },
    { text: "What seems to us as bitter trials are often blessings in disguise.", author: "Oscar Wilde" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Little by little, a little becomes a lot.", author: "Tanzanian Proverb" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Keep going. Everything you need will come to you at the perfect time.", author: "Unknown" },
];

let currentQuoteIndex = 0;

function getRandomQuote(excludeIndex) {
    let idx;
    do {
        idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    } while (idx === excludeIndex && MOTIVATIONAL_QUOTES.length > 1);
    return { idx, quote: MOTIVATIONAL_QUOTES[idx] };
}

function updateAllowanceTracker(totalMins, avgMins, remainingMins, pct, daysAttended) {
    const earned = daysAttended * ALLOWANCE_PER_DAY;

    // Project remaining working days based on avg pace, or assume 8h/day
    const effectiveAvgMins = avgMins > 0 ? avgMins : AVG_HOURS_FALLBACK * 60;
    const remainingDays = remainingMins > 0 ? Math.ceil(remainingMins / effectiveAvgMins) : 0;
    const remainingAllowance = remainingDays * ALLOWANCE_PER_DAY;
    const totalProjected = earned + remainingAllowance;

    // Projected total days for progress bar
    const projectedTotalDays = daysAttended + remainingDays;

    // Format with peso sign and commas
    const fmt = (n) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    setEl('allowanceEarned', fmt(earned));
    setEl('allowanceEarnedDays', `${daysAttended} day${daysAttended !== 1 ? 's' : ''} × ₱350`);
    setEl('allowanceTotal', fmt(totalProjected));

    // Progress bar
    const dayPct = projectedTotalDays > 0 ? Math.min(100, Math.round((daysAttended / projectedTotalDays) * 100)) : 0;
    const progFill = document.getElementById('allowanceProgressFill');
    if (progFill) progFill.style.width = `${dayPct}%`;
    setEl('allowanceProgressText', `${daysAttended} / ${projectedTotalDays} days`);
    setEl('allowancePercent', `${dayPct}% of internship complete`);

    // Set initial random quote once on first load
    const quoteEl = document.getElementById('motivationalQuote');
    if (quoteEl && quoteEl.dataset.initialized !== 'true') {
        const { idx, quote } = getRandomQuote(-1);
        currentQuoteIndex = idx;
        quoteEl.textContent = `"${quote.text}"`;
        setEl('motivationalAuthor', `— ${quote.author}`);
        quoteEl.dataset.initialized = 'true';
    }
}

function cheerMeUp() {
    const { idx, quote } = getRandomQuote(currentQuoteIndex);
    currentQuoteIndex = idx;

    const quoteEl = document.getElementById('motivationalQuote');
    const authorEl = document.getElementById('motivationalAuthor');
    if (!quoteEl) return;

    quoteEl.style.opacity = '0';
    quoteEl.style.transform = 'translateY(6px)';
    setTimeout(() => {
        quoteEl.textContent = `"${quote.text}"`;
        if (authorEl) authorEl.textContent = `— ${quote.author}`;
        quoteEl.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        quoteEl.style.opacity = '1';
        quoteEl.style.transform = 'translateY(0)';
    }, 200);
}

// ==================== ESTIMATE COMPLETION ====================

/* ---- Philippine Public Holiday Helpers ---- */
function computeEasterDate(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function getLastMondayOfAugust(year) {
    const lastDay = new Date(year, 7, 31); // Aug 31
    const dow = lastDay.getDay(); // 0=Sun
    const offset = dow === 0 ? 6 : dow - 1;
    lastDay.setDate(lastDay.getDate() - offset);
    return formatLocalDate(lastDay);
}

function getPHHolidays(year) {
    const fixed = [
        `${year}-01-01`, // New Year's Day
        `${year}-02-25`, // People Power Revolution
        `${year}-04-09`, // Araw ng Kagitingan
        `${year}-05-01`, // Labor Day
        `${year}-06-12`, // Independence Day
        `${year}-08-21`, // Ninoy Aquino Day
        `${year}-11-01`, // All Saints Day
        `${year}-11-02`, // All Souls Day
        `${year}-11-30`, // Bonifacio Day
        `${year}-12-08`, // Immaculate Conception
        `${year}-12-24`, // Christmas Eve
        `${year}-12-25`, // Christmas Day
        `${year}-12-30`, // Rizal Day
        `${year}-12-31`, // New Year's Eve
        getLastMondayOfAugust(year),  // National Heroes Day
    ];
    // Easter-based: Maundy Thursday (−3) and Good Friday (−2) from Easter
    const easter = computeEasterDate(year);
    const maundy = new Date(easter); maundy.setDate(maundy.getDate() - 3);
    const goodFri = new Date(easter); goodFri.setDate(goodFri.getDate() - 2);
    fixed.push(formatLocalDate(maundy));
    fixed.push(formatLocalDate(goodFri));
    return new Set(fixed);
}

function isWorkDay(date, holidaySet) {
    const dow = date.getDay();
    if (dow === 0 || dow === 6) return false; // weekend
    return !holidaySet.has(formatLocalDate(date));
}

function updateEstimate(totalMins, avgMins) {
    const estText = document.getElementById('estimateText');
    const estBadge = document.getElementById('estimateBadge');

    if (avgMins === 0) {
        if (estText) estText.textContent = 'Log your hours to see your estimated completion date.';
        if (estBadge) estBadge.textContent = '—';
        return;
    }

    const remainingMins = Math.max(0, REQUIRED_HOURS * 60 - totalMins);
    if (remainingMins === 0) {
        if (estText) estText.textContent = '🎉 Congratulations! You have completed your 240-hour internship requirement!';
        if (estBadge) estBadge.innerHTML = '<span style="color:var(--p4a-green)">Completed!</span>';
        return;
    }

    const remainingDays = Math.ceil(remainingMins / avgMins);
    let workDaysAdded = 0;
    const currentDate = new Date();
    // Pre-load holidays for this year and next (spans may cross year boundary)
    const thisYear = currentDate.getFullYear();
    const holidays = new Set([...getPHHolidays(thisYear), ...getPHHolidays(thisYear + 1)]);

    while (workDaysAdded < remainingDays) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (isWorkDay(currentDate, holidays)) workDaysAdded++;
    }

    const dateLabel = currentDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    if (estText) estText.textContent = `At your current pace of ${minutesToHM(avgMins)}/day, you need ${remainingDays} more work days (excl. weekends & PH holidays).`;
    if (estBadge) estBadge.textContent = dateLabel;
}

// ==================== RECENT ACTIVITY ====================
function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    if (records.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="fa-regular fa-calendar-xmark"></i>
            <p>No hours logged yet.<br>Start logging to see your activity!</p>
        </div>`;
        return;
    }

    const recent = records.slice(0, 6);
    container.innerHTML = recent.map(r => `
        <div class="recent-item">
            <div class="recent-dot"></div>
            <div class="recent-info">
                <div class="recent-date">${formatDate(r.date)} ${r.dept ? '· ' + r.dept : ''}</div>
                <div class="recent-task" title="${escapeHtml(r.task)}">${escapeHtml(r.task)}</div>
            </div>
            <span class="recent-hours">${minutesToHM(r.durationMins)}</span>
            <div class="recent-actions">
                <button class="icon-btn icon-btn-edit" onclick="openEditModal(${records.indexOf(r)})" title="Edit">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="icon-btn icon-btn-delete" onclick="openDeleteModal(${records.indexOf(r)})" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==================== RECORDS TABLE ====================
function renderRecordsTable(filter = '') {
    const tbody = document.getElementById('recordsBody');
    const emptyEl = document.getElementById('emptyRecords');
    const tableFooter = document.getElementById('tableFooter');
    const countEl = document.getElementById('recordCount');
    const totalEl = document.getElementById('tableTotalHours');

    if (!tbody) return;

    const query = filter.toLowerCase();
    const filtered = records.filter(r =>
        !query ||
        formatDate(r.date).toLowerCase().includes(query) ||
        r.task.toLowerCase().includes(query) ||
        (r.dept && r.dept.toLowerCase().includes(query)) ||
        (r.learning && r.learning.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (tableFooter) tableFooter.style.display = 'none';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (tableFooter) tableFooter.style.display = 'flex';

    const totalMins = filtered.reduce((s, r) => s + r.durationMins, 0);
    if (countEl) countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;
    if (totalEl) totalEl.textContent = `Total: ${minutesToHM(totalMins)}`;

    tbody.innerHTML = filtered.map((r, idx) => {
        const gross = r.grossMins || (r.durationMins + LUNCH_BREAK_MINS);
        const realIdx = records.indexOf(r);
        return `
        <tr onclick="openRecordModal(${realIdx})">
            <td>${idx + 1}</td>
            <td class="td-date">
                ${formatDate(r.date)}
                <div class="td-day-of-week">${new Date(r.date).toLocaleDateString('en-PH', { weekday: 'long' })}</div>
            </td>
            <td class="td-time">${formatTime(r.timeIn)}</td>
            <td class="td-time">${formatTime(r.timeOut)}</td>
            <td class="td-hours">
                ${minutesToHM(r.durationMins)}
                <div class="td-gross">${minutesToHM(gross)} gross</div>
            </td>
            <td class="td-task" title="${escapeHtml(r.task)}">${escapeHtml(r.task)}</td>
            <td class="rating-emoji">${r.mood ? moodEmoji(r.mood) : '—'}</td>
            <td onclick="event.stopPropagation()">
                <div class="action-btns">
                    <button class="icon-btn icon-btn-edit" onclick="openEditModal(${realIdx})" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn icon-btn-delete" onclick="openDeleteModal(${realIdx})" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterRecords() {
    const q = document.getElementById('searchRecords').value;
    renderRecordsTable(q);
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ==================== DELETE RECORD ====================
function openDeleteModal(idx) {
    deleteTargetIndex = idx;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    deleteTargetIndex = null;
    document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete() {
    if (deleteTargetIndex !== null && deleteTargetIndex < records.length) {
        records.splice(deleteTargetIndex, 1);
        saveRecords();
        updateAllUI();
        renderRecordsTable(document.getElementById('searchRecords')?.value || '');
        showToast('Entry deleted.', 'warning');
    }
    closeDeleteModal();
}

// ==================== EDIT RECORD ====================
function openEditModal(idx) {
    const r = records[idx];
    if (!r) return;

    document.getElementById('editDate').value = r.date;
    document.getElementById('editTimeIn').value = r.timeIn;
    document.getElementById('editTimeOut').value = r.timeOut;
    document.getElementById('editTask').value = r.task;
    document.getElementById('editDept').value = r.dept || '';
    document.getElementById('editLearning').value = r.learning || '';
    document.getElementById('editType').value = r.type || 'regular';
    document.getElementById('editIndex').value = idx;

    // Pre-select the existing mood
    editSelectedMood = r.mood || 0;
    document.querySelectorAll('.edit-mood-btn').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.mood) === editSelectedMood);
        // Set up click handler (re-assign to avoid duplicates)
        btn.onclick = () => {
            editSelectedMood = parseInt(btn.dataset.mood);
            document.querySelectorAll('.edit-mood-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
    });

    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
    const idx = parseInt(document.getElementById('editIndex').value);
    if (isNaN(idx) || idx >= records.length) return;

    const date = document.getElementById('editDate').value;
    const timeIn = document.getElementById('editTimeIn').value;
    const timeOut = document.getElementById('editTimeOut').value;
    const task = document.getElementById('editTask').value.trim();
    const dept = document.getElementById('editDept').value;
    const learning = document.getElementById('editLearning').value.trim();
    const type = document.getElementById('editType').value;

    if (!task) { showToast('Please enter a task description.', 'error'); return; }

    const grossMins = calcGrossDuration(timeIn, timeOut);
    const durationMins = calcDuration(timeIn, timeOut);
    if (grossMins <= LUNCH_BREAK_MINS) { showToast('Work hours must be more than 1 hour (lunch break).', 'error'); return; }

    records[idx] = { ...records[idx], date, timeIn, timeOut, grossMins, durationMins, task, dept, learning, type, mood: editSelectedMood };
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveRecords();
    updateAllUI();
    renderRecordsTable(document.getElementById('searchRecords')?.value || '');
    closeEditModal();
    showToast('Entry updated successfully!', 'success');
}

// ==================== RECORD DETAIL MODAL ====================
function openRecordModal(idx) {
    const r = records[idx];
    if (!r) return;

    const gross = r.grossMins || (r.durationMins + LUNCH_BREAK_MINS);

    document.getElementById('rptDate').textContent = formatDate(r.date);
    document.getElementById('rptHours').textContent = minutesToHM(r.durationMins);
    document.getElementById('rptTimeIn').textContent = formatTime(r.timeIn);
    document.getElementById('rptTimeOut').textContent = formatTime(r.timeOut);
    document.getElementById('rptGross').textContent = minutesToHM(gross);
    document.getElementById('rptTask').textContent = r.task || '—';

    // Department
    const deptEl = document.getElementById('rptDept');
    deptEl.textContent = r.dept || '—';
    if (r.dept) {
        deptEl.style.color = 'var(--p4a-yellow-dark)';
        deptEl.style.fontWeight = '700';
    } else {
        deptEl.style.color = '';
        deptEl.style.fontWeight = '';
    }

    // Day type
    const typeMap = { regular: 'Regular Day', holiday: 'Holiday Work', makeup: 'Make-up Day', virtual: 'Virtual / Remote' };
    document.getElementById('rptType').textContent = typeMap[r.type] || r.type || 'Regular Day';

    // Mood
    document.getElementById('rptMood').textContent = r.mood ? moodEmoji(r.mood) : 'Not rated';

    // Learnings
    const learningSection = document.getElementById('rptLearningSection');
    const learningBody = document.getElementById('rptLearning');
    if (r.learning && r.learning.trim()) {
        learningBody.textContent = r.learning;
        learningSection.style.display = '';
    } else {
        learningSection.style.display = 'none';
    }

    // Wire Edit button
    const editBtn = document.getElementById('rptEditBtn');
    editBtn.onclick = () => { closeRecordModal(); openEditModal(idx); };

    document.getElementById('recordDetailModal').style.display = 'flex';
}

function closeRecordModal() {
    document.getElementById('recordDetailModal').style.display = 'none';
}

// Close modals on overlay click
document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDeleteModal();
});
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditModal();
});
document.getElementById('recordDetailModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRecordModal();
});

// ==================== REPORTS ====================
function buildWeeklyChart() {
    const container = document.getElementById('weeklyChart');
    if (!container) return;

    if (records.length === 0) {
        container.innerHTML = `<div class="chart-empty"><i class="fa-solid fa-chart-simple"></i><p>Log hours to see weekly breakdown</p></div>`;
        return;
    }

    // Group by week
    const weekData = {};
    records.forEach(r => {
        const d = new Date(r.date + 'T00:00:00');
        // Get week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d.setDate(diff));
        const key = weekStart.toISOString().split('T')[0];
        weekData[key] = (weekData[key] || 0) + r.durationMins;
    });

    const weeks = Object.entries(weekData).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    const maxMins = Math.max(...weeks.map(w => w[1]), 1);

    container.innerHTML = weeks.map(([weekKey, mins]) => {
        const d = new Date(weekKey + 'T00:00:00');
        const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        const height = Math.max(4, Math.round((mins / maxMins) * 160));
        return `<div class="bar-item">
            <div class="bar-value">${(mins/60).toFixed(1)}h</div>
            <div class="bar-fill" style="height:${height}px" title="${minutesToHM(mins)}"></div>
            <div class="bar-label">${label}</div>
        </div>`;
    }).join('');
}

function updateDonutChart() {
    const totalMins = getTotalMinutes();
    const pct = Math.min(100, Math.round((totalMins / (REQUIRED_HOURS * 60)) * 100));
    const circumference = 2 * Math.PI * 55;
    const offset = circumference - (pct / 100) * circumference;

    const donutFill = document.getElementById('donutFill');
    if (donutFill) {
        donutFill.style.strokeDasharray = circumference;
        donutFill.style.strokeDashoffset = offset;
    }

    setEl('donutVal', `${pct}%`);
    setEl('legendDone', `${(totalMins/60).toFixed(1)}h`);
    setEl('legendRemaining', `${Math.max(0, REQUIRED_HOURS - totalMins/60).toFixed(1)}h`);
}



function buildRatingChart() {
    const container = document.getElementById('ratingChart');
    if (!container) return;

    const ratingData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    records.forEach(r => {
        if (r.mood && r.mood >= 1 && r.mood <= 5) {
            ratingData[r.mood]++;
            total++;
        }
    });

    if (total === 0) {
        container.innerHTML = `<div class="chart-empty"><i class="fa-regular fa-face-smile"></i><p>Rate your days to see distribution</p></div>`;
        return;
    }

    const emojis = { 1: '😞', 2: '😐', 3: '🙂', 4: '😊', 5: '🌟' };
    container.innerHTML = [5,4,3,2,1].map(rating => {
        const count = ratingData[rating];
        const width = total > 0 ? Math.round((count / total) * 100) : 0;
        return `<div class="rating-row">
            <div class="rating-emoji-label">${emojis[rating]}</div>
            <div class="rating-bar-wrap">
                <div class="rating-bar-fill" style="width:${width}%"></div>
            </div>
            <div class="rating-count">${count}</div>
        </div>`;
    }).join('');
}

function updateReportSummary() {
    const totalMins = getTotalMinutes();
    const days = records.length;
    const avg = days > 0 ? Math.round(totalMins / days) : 0;
    const max = records.reduce((m, r) => r.durationMins > m.durationMins ? r : m, { durationMins: 0, date: '' });
    const best = records.reduce((b, r) => (r.mood || 0) > (b.mood || 0) ? r : b, { mood: 0, date: '' });
    const pct = Math.min(100, Math.round((totalMins / (REQUIRED_HOURS * 60)) * 100));

    setEl('repTotal', minutesToHM(totalMins));
    setEl('repDays', `${days} day${days !== 1 ? 's' : ''}`);
    setEl('repAvg', minutesToHM(avg));
    setEl('repMax', max.date ? `${minutesToHM(max.durationMins)} (${formatDate(max.date)})` : '—');
    setEl('repBest', best.date ? `${moodEmoji(best.mood)} ${formatDate(best.date)}` : '—');
    setEl('repPercent', `${pct}%`);
}

// ==================== TASK & LEARNING LOG ====================
function renderLearningsLog() {
    const container = document.getElementById('learningsLogList');
    if (!container) return;

    if (records.length === 0) {
        container.innerHTML = `
            <div class="learnings-log-empty">
                <i class="fa-regular fa-folder-open"></i>
                <p>No records found. Log your hours to see your accomplishments and learnings here!</p>
            </div>`;
        return;
    }

    // Sort records by date descending (latest first)
    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sortedRecords.map(r => {
        const deptTag = r.dept ? `<span class="dept-tag" style="margin-left: 8px;">${r.dept}</span>` : '';
        const ratingEmojiHtml = r.mood ? `<span style="font-size: 1rem; margin-left: 8px;">${moodEmoji(r.mood)}</span>` : '';
        const learningHtml = r.learning && r.learning.trim() 
            ? `<div class="learnings-log-learning">
                <i class="fa-solid fa-lightbulb"></i>
                <div>${escapeHtml(r.learning)}</div>
               </div>`
            : '';

        return `
            <div class="learnings-log-item">
                <div class="learnings-log-meta">
                    <span class="learnings-log-date">${formatDate(r.date)} ${deptTag} ${ratingEmojiHtml}</span>
                    <span class="learnings-log-hours">${minutesToHM(r.durationMins)}</span>
                </div>
                <div class="learnings-log-task">${escapeHtml(r.task)}</div>
                ${learningHtml}
            </div>
        `;
    }).join('');
}

// ==================== EXPORT CSV ====================
function exportCSV() {
    if (records.length === 0) {
        showToast('No records to export!', 'warning');
        return;
    }

    const headers = ['#', 'Date', 'Day Type', 'Time In', 'Time Out', 'Gross Duration (hrs)', 'Net Duration (hrs)', 'Net Duration (mins)', 'Lunch Break Deducted', 'Department', 'Task/Activity', 'Key Learnings', 'Day Rating'];

    const rows = records.map((r, i) => {
        const gross = r.grossMins || (r.durationMins + LUNCH_BREAK_MINS);
        return [
            i + 1,
            r.date,
            r.type || 'regular',
            r.timeIn,
            r.timeOut,
            (gross / 60).toFixed(2),
            (r.durationMins / 60).toFixed(2),
            r.durationMins,
            '1h (60 mins)',
            r.dept || '',
            `"${(r.task || '').replace(/"/g, '""')}"`,
            `"${(r.learning || '').replace(/"/g, '""')}"`,
            r.mood ? `${r.mood} - ${['Poor','Okay','Good','Great','Excellent'][r.mood-1]}` : ''
        ];
    });

    const totalMins = getTotalMinutes();
    const totalGrossMins = records.reduce((s, r) => s + (r.grossMins || r.durationMins + LUNCH_BREAK_MINS), 0);
    rows.push([]);
    rows.push(['', '', '', '', 'TOTAL (net)', (totalGrossMins/60).toFixed(2), (totalMins/60).toFixed(2), totalMins, `${records.length}h deducted`, '', '', '', '']);
    rows.push(['', '', '', '', 'Required', '', 240, 240*60, '', '', '', '', '']);
    rows.push(['', '', '', '', 'Remaining', '', Math.max(0, 240 - totalMins/60).toFixed(2), Math.max(0, 240*60 - totalMins), '', '', '', '', '']);
    rows.push([]);
    rows.push(['NOTE: Net hours = Gross hours minus 1-hour lunch break per day. Only net hours count toward the 240-hour requirement.']);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `P4A_Intern_Hours_${formatLocalDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully!', 'success');
}

// ==================== PRINT REPORT ====================
function printReport() {
    const totalMins = getTotalMinutes();
    const days = records.length;
    const avg = days > 0 ? Math.round(totalMins / days) : 0;
    const pct = Math.min(100, Math.round((totalMins / (REQUIRED_HOURS * 60)) * 100));
    const remainingMins = Math.max(0, REQUIRED_HOURS * 60 - totalMins);

    const name = safeLocalStorage.getItem(INTERN_NAME_KEY) || 'Nica Desacola';
    const dept = safeLocalStorage.getItem(INTERN_DEPT_KEY) || 'Engineering';
    const school = safeLocalStorage.getItem(INTERN_SCHOOL_KEY) || 'University of Manila';
    const internId = safeLocalStorage.getItem(INTERN_ID_KEY) || 'P4A-2026-001';

    const tableRows = records.map((r, i) => {
        const dateStr = formatDate(r.date);
        const timeInStr = formatTime(r.timeIn);
        const timeOutStr = formatTime(r.timeOut);
        const typeMap = { regular: 'Regular', holiday: 'Holiday', makeup: 'Makeup', virtual: 'Virtual' };
        const dayType = typeMap[r.type] || r.type || 'Regular';
        return `
            <tr>
                <td class="col-num">${i+1}</td>
                <td class="col-date">${dateStr}<br><span style="font-size:8px;color:#888;font-weight:normal;">${dayType}</span></td>
                <td class="col-time">${timeInStr} &ndash; ${timeOutStr}</td>
                <td class="col-dur">${minutesToHM(r.durationMins)}</td>
                <td class="col-dept">${r.dept || '—'}</td>
                <td class="col-task">
                    <strong>${escapeHtml(r.task)}</strong>
                    ${r.learning ? `<div style="font-size:8.5px;color:#666;margin-top:3px;font-style:italic;">Key learning: ${escapeHtml(r.learning)}</div>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>POWER 4 ALL — Internship Daily Time Record (DTR)</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 11px;
                    color: #202224;
                    background: #fff;
                    line-height: 1.4;
                    padding: 30px;
                }
                
                /* Logo and Document Title */
                .header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    border-bottom: 2px solid #202224;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                }
                .logo-section {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .title-section {
                    text-align: right;
                }
                .title-section h1 {
                    font-size: 18px;
                    font-weight: 700;
                    color: #202224;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 3px;
                }
                .title-section p {
                    font-size: 10px;
                    color: #666;
                }

                /* Structured Profile Grid Table */
                .info-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .info-table td {
                    padding: 6px 10px;
                    border: 1px solid #c8cbd0;
                    font-size: 10px;
                }
                .info-table td.label {
                    background: #f1f3f4;
                    font-weight: 600;
                    color: #333;
                    width: 15%;
                    text-transform: uppercase;
                    font-size: 8.5px;
                }
                .info-table td.value {
                    width: 35%;
                    color: #202224;
                }

                /* Formal DTR Summary Table */
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .summary-table th {
                    background: #f1f3f4;
                    color: #202224;
                    border: 1px solid #c8cbd0;
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    padding: 6px 10px;
                    text-align: center;
                }
                .summary-table td {
                    border: 1px solid #c8cbd0;
                    padding: 8px 10px;
                    text-align: center;
                    font-size: 11px;
                    color: #202224;
                }

                /* DTR Log Table */
                .section-header {
                    font-size: 11px;
                    font-weight: 700;
                    color: #202224;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }
                .dtr-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .dtr-table th {
                    background: #f1f3f4;
                    color: #202224;
                    border: 1px solid #c8cbd0;
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    padding: 7px 9px;
                    text-align: left;
                }
                .dtr-table td {
                    padding: 7px 9px;
                    border: 1px solid #c8cbd0;
                    font-size: 9.5px;
                    color: #202224;
                    vertical-align: top;
                    word-break: break-word;
                }
                .dtr-table tr:nth-child(even) {
                    background: #fcfcfc;
                }
                
                .col-num { width: 35px; text-align: center; }
                .col-date { width: 100px; font-weight: bold; }
                .col-time { width: 120px; }
                .col-dur { width: 80px; font-weight: bold; text-align: center; }
                .col-dept { width: 100px; }
                .col-task { line-height: 1.4; }

                /* Certification & Signatures */
                .sign-off-block {
                    margin-top: 30px;
                    page-break-inside: avoid;
                }
                .certification-statement {
                    font-size: 9.5px;
                    line-height: 1.5;
                    color: #333;
                    background: #f9f9f9;
                    padding: 10px 12px;
                    border: 1px solid #c8cbd0;
                    border-left: 3px solid #202224;
                    margin-bottom: 30px;
                }
                .signature-layout {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 80px;
                }
                .signature-column {
                    display: flex;
                    flex-direction: column;
                }
                .signature-label {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #555;
                    margin-bottom: 45px;
                }
                .signature-line {
                    border-bottom: 1px dashed #202224;
                    margin-bottom: 4px;
                }
                .printed-name {
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #202224;
                }
                .designation {
                    font-size: 8.5px;
                    color: #666;
                }

                @media print {
                    body { padding: 0; margin: 0; }
                    tr { page-break-inside: avoid; }
                    .header-container { margin-top: 0; }
                    img, svg, div, table, tr, td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="logo-section">
                    <!-- Clean Monochrome Gray SVG Logo -->
                    <svg width="120" height="34" viewBox="0 0 320 90" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                        <circle cx="64" cy="42" r="32" fill="#585e63" opacity="0.65"/>
                        <line x1="10" y1="18" x2="310" y2="18" stroke="#202224" stroke-width="6" stroke-linecap="square"/>
                        <text x="12" y="60" font-family="Arial, sans-serif" font-weight="900" font-size="42" fill="#202224" letter-spacing="0.5">POWER</text>
                        <text x="180" y="82" font-family="Arial, sans-serif" font-weight="900" font-size="82" fill="#202224">4</text>
                        <text x="228" y="60" font-family="Arial, sans-serif" font-weight="900" font-size="42" fill="#202224" letter-spacing="0.5">ALL</text>
                        <line x1="10" y1="69" x2="172" y2="69" stroke="#202224" stroke-width="6" stroke-linecap="square"/>
                        <line x1="226" y1="69" x2="310" y2="69" stroke="#202224" stroke-width="6" stroke-linecap="square"/>
                        <circle cx="308" cy="80" r="5" fill="none" stroke="#202224" stroke-width="1"/>
                        <text x="305" y="83" font-family="Arial, sans-serif" font-weight="bold" font-size="6" fill="#202224">R</text>
                    </svg>
                </div>
                <div class="title-section">
                    <h1>Daily Time Record (DTR)</h1>
                    <p>POWER 4 ALL, Inc. &middot; Internship Training Program</p>
                </div>
            </div>

            <!-- Profile Info Table -->
            <table class="info-table">
                <tr>
                    <td class="label">Intern Name</td>
                    <td class="value"><strong>${name}</strong></td>
                    <td class="label">Intern ID</td>
                    <td class="value">${internId}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">${dept}</td>
                    <td class="label">School</td>
                    <td class="value">${school}</td>
                </tr>
            </table>

            <!-- DTR Metrics Summary Table -->
            <div class="section-header">Attendance Summary Metrics</div>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Total Net Hours Logged</th>
                        <th>Required Hours</th>
                        <th>Hours Remaining</th>
                        <th>Days Attended</th>
                        <th>Average Daily Hours</th>
                        <th>Completion Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>${minutesToDecimalHours(totalMins).toFixed(1)} hrs</strong></td>
                        <td>${REQUIRED_HOURS.toFixed(1)} hrs</td>
                        <td><strong>${minutesToDecimalHours(remainingMins).toFixed(1)} hrs</strong></td>
                        <td>${days} days</td>
                        <td>${minutesToHM(avg)}</td>
                        <td><strong>${pct}%</strong></td>
                    </tr>
                </tbody>
            </table>

            <!-- Detailed Log Entries -->
            <div class="section-header">Attendance Log Details</div>
            <table class="dtr-table">
                <thead>
                    <tr>
                        <th class="col-num">#</th>
                        <th class="col-date">Date</th>
                        <th class="col-time">Time In &ndash; Time Out</th>
                        <th class="col-dur">Duration (Net)</th>
                        <th class="col-dept">Department</th>
                        <th class="col-task">Activity &amp; Accomplishments Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <!-- Certification & Sign-off -->
            <div class="sign-off-block">
                <div class="certification-statement">
                    I hereby certify on my honor that the daily attendance logs, clocked hours, and descriptions of tasks completed herein are a true, accurate, and faithful record of my actual hours served during my internship training at <strong>POWER 4 ALL, Inc.</strong>
                </div>
                <div class="signature-layout">
                    <div class="signature-column">
                        <span class="signature-label">Prepared By (Intern)</span>
                        <div class="signature-line"></div>
                        <span class="printed-name">${name}</span>
                        <span class="designation">Signature &amp; Date</span>
                    </div>
                    <div class="signature-column">
                        <span class="signature-label">Verified &amp; Approved By</span>
                        <div class="signature-line"></div>
                        <span class="printed-name">&nbsp;</span>
                        <span class="designation">Internship Supervisor Signature &amp; Date</span>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const w = window.open('', '_blank');
    w.document.write(printHtml);
    w.document.close();
    w.print();
}

// ==================== HERO PARTICLES ====================
function buildHeroParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;

    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'hero-particle';
        const size = Math.random() * 20 + 5;
        const left = Math.random() * 100;
        const duration = Math.random() * 8 + 6;
        const delay = Math.random() * 8;
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${left}%;
            bottom: -${size}px;
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        container.appendChild(particle);
    }
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==================== AUTHENTICATION MANAGEMENT ====================
let isSignUpMode = false;
let isAdminMode = false;

function checkAuthStatus() {
    const sessionUser = safeSessionStorage.getItem('p4a_logged_in_user');
    const overlay = document.getElementById('authOverlay');
    const logoutBtn = document.getElementById('logoutBtn');

    if (sessionUser) {
        if (overlay) overlay.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';
    } else {
        if (overlay) overlay.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function setAuthMode(mode) {
    isSignUpMode = (mode === 'signup');
    isAdminMode = (mode === 'admin');

    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const btnLabel = document.getElementById('authBtnLabel');
    const toggleMsg = document.getElementById('authToggleMsg');
    const toggleLink = document.getElementById('authToggleLink');
    const adminToggle = document.getElementById('adminToggleLink');
    const passwordRules = document.getElementById('passwordRules');

    if (mode === 'signup') {
        if (title) title.textContent = 'Create Account';
        if (subtitle) subtitle.textContent = 'Register an account to start tracking your internship.';
        if (btnLabel) btnLabel.textContent = 'Sign Up';
        if (toggleMsg) toggleMsg.textContent = 'Already have an account?';
        if (toggleLink) {
            toggleLink.textContent = 'Sign In';
            toggleLink.setAttribute('onclick', "setAuthMode('signin')");
        }
        if (passwordRules) passwordRules.classList.add('visible');
        if (adminToggle) {
            adminToggle.style.display = 'none';
            if (adminToggle.parentElement) adminToggle.parentElement.style.display = 'none';
        }
    } else if (mode === 'signin') {
        if (title) title.textContent = 'Sign In';
        if (subtitle) subtitle.textContent = 'Please enter your credentials to access the hours tracker.';
        if (btnLabel) btnLabel.textContent = 'Sign In';
        if (toggleMsg) toggleMsg.textContent = "Don't have an account?";
        if (toggleLink) {
            toggleLink.textContent = 'Sign Up';
            toggleLink.setAttribute('onclick', "setAuthMode('signup')");
        }
        if (passwordRules) passwordRules.classList.remove('visible');
        if (adminToggle) {
            adminToggle.style.display = 'inline';
            if (adminToggle.parentElement) adminToggle.parentElement.style.display = 'block';
        }
    } else if (mode === 'admin') {
        if (title) title.textContent = 'Admin Portal';
        if (subtitle) subtitle.textContent = 'Log in with administrator credentials.';
        if (btnLabel) btnLabel.textContent = 'Admin Login';
        if (toggleMsg) toggleMsg.textContent = 'Are you an intern?';
        if (toggleLink) {
            toggleLink.textContent = 'Intern Login';
            toggleLink.setAttribute('onclick', "setAuthMode('signin')");
        }
        if (passwordRules) passwordRules.classList.remove('visible');
        if (adminToggle) {
            adminToggle.style.display = 'none';
            if (adminToggle.parentElement) adminToggle.parentElement.style.display = 'none';
        }
    }

    clearAuthFieldError('authEmail');
    clearAuthFieldError('authPass');
}

function showAuthFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    if (input) input.classList.add('input-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
}

function clearAuthFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    if (input) input.classList.remove('input-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }
}

function shakeAuthForm() {
    const form = document.getElementById('authForm');
    if (!form) return;
    form.classList.remove('shake');
    void form.offsetWidth; // reflow to restart animation
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 500);
}

function onPasswordInput() {
    clearAuthFieldError('authPass');
    if (!isSignUpMode) return;
    const val = document.getElementById('authPass').value;
    const rules = {
        'rule-length': val.length >= 8,
        'rule-upper':  /[A-Z]/.test(val),
        'rule-number': /[0-9]/.test(val)
    };
    Object.entries(rules).forEach(([id, passed]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const icon = el.querySelector('i');
        if (passed) {
            el.classList.add('passed');
            if (icon) { icon.classList.remove('fa-circle-xmark'); icon.classList.add('fa-circle-check'); }
        } else {
            el.classList.remove('passed');
            if (icon) { icon.classList.remove('fa-circle-check'); icon.classList.add('fa-circle-xmark'); }
        }
    });
}

function handleAuthSubmit(e) {
    e.preventDefault();
    clearAuthFieldError('authEmail');
    clearAuthFieldError('authPass');

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPass').value;
    let hasError = false;

    // Email empty check
    if (!email) {
        showAuthFieldError('authEmail', 'Email address is required.');
        hasError = true;
    } else if (!email.includes('@')) {
        showAuthFieldError('authEmail', 'Enter a valid email address.');
        hasError = true;
    } else if (!email.endsWith('@power4all.org')) {
        showAuthFieldError('authEmail', 'Only @power4all.org email addresses are allowed.');
        hasError = true;
    }

    // Password empty check
    if (!password) {
        showAuthFieldError('authPass', 'Password is required.');
        hasError = true;
    } else if (isSignUpMode) {
        // Password strength rules on Sign Up
        if (password.length < 8) {
            showAuthFieldError('authPass', 'Password must be at least 8 characters.');
            hasError = true;
        } else if (!/[A-Z]/.test(password)) {
            showAuthFieldError('authPass', 'Password must include at least one uppercase letter.');
            hasError = true;
        } else if (!/[0-9]/.test(password)) {
            showAuthFieldError('authPass', 'Password must include at least one number.');
            hasError = true;
        }
    }

    if (hasError) {
        shakeAuthForm();
        return;
    }

    const users = JSON.parse(safeLocalStorage.getItem('p4a_users') || '[]');

    if (isSignUpMode) {
        // Sign Up check
        const userExists = users.some(u => u.email === email);
        if (userExists) {
            showAuthFieldError('authEmail', 'An account with this email already exists. Try signing in!');
            shakeAuthForm();
            return;
        }

        // Add new user
        users.push({ email, password });
        safeLocalStorage.setItem('p4a_users', JSON.stringify(users));
        showToast('Sign up successful! Please sign in.', 'success');
        
        // Auto-switch to login
        setAuthMode('signin');
        document.getElementById('authPass').value = '';
    } else {
        // Sign In check
        const matchedUser = users.find(u => u.email === email && u.password === password);
        
        if (isAdminMode) {
            // Check if admin
            if (email === 'admin@power4all.org' && password === 'admin') {
                safeSessionStorage.setItem('p4a_logged_in_admin', 'true');
                window.location.href = 'admin.html';
                return;
            } else {
                showAuthFieldError('authEmail', 'Invalid admin credentials.');
                shakeAuthForm();
                return;
            }
        }

        // If empty users list (first run), seed a default account or let them log in
        if (!matchedUser && users.length === 0 && email === 'intern@power4all.org' && password === 'intern') {
            users.push({ email, password });
            safeLocalStorage.setItem('p4a_users', JSON.stringify(users));
            safeSessionStorage.setItem('p4a_logged_in_user', email);
            checkAuthStatus();
            if (typeof showSection === 'function') showSection('dashboard');
            showToast('Welcome to Power 4 All!', 'success');
            return;
        }

        if (matchedUser) {
            safeSessionStorage.setItem('p4a_logged_in_user', email);
            checkAuthStatus();
            if (typeof showSection === 'function') showSection('dashboard');
            showToast('Logged in successfully.', 'success');
        } else {
            showAuthFieldError('authEmail', 'Email or password is incorrect.');
            showAuthFieldError('authPass', 'Check your credentials and try again.');
            shakeAuthForm();
        }
    }
}

function logout() {
    safeSessionStorage.removeItem('p4a_logged_in_user');
    checkAuthStatus();
    showToast('Logged out successfully.', 'info');
}

// Reveal Password Toggle
function togglePasswordVisibility() {
    const passInput = document.getElementById('authPass');
    const eyeIcon = document.getElementById('togglePasswordIcon');
    if (!passInput || !eyeIcon) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// Auto Inactivity Logout: Logs out after 30 minutes of no user interaction
let inactivityTimeout;

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    
    // Only set the timer if user is currently logged in
    const sessionUser = safeSessionStorage.getItem('p4a_logged_in_user');
    if (sessionUser) {
        inactivityTimeout = setTimeout(() => {
            logout();
            showToast('Logged out automatically due to inactivity.', 'info');
        }, 30 * 60 * 1000); // 30 minutes in milliseconds
    }
}

// Track user actions for inactivity
['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
});


// ==================== TO-DO FEATURE ====================
let todos = [];
let todoFilter = 'all';

function loadTodos() {
    try {
        const stored = safeLocalStorage.getItem(TODO_KEY);
        todos = stored ? JSON.parse(stored) : [];
    } catch (e) {
        todos = [];
    }
}

function saveTodos() {
    safeLocalStorage.setItem(TODO_KEY, JSON.stringify(todos));
    if (typeof checkAchievements === 'function') checkAchievements();
}

function addTodoItem() {
    const input = document.getElementById('todoInput');
    const priority = document.getElementById('todoPriority').value;
    const category = document.getElementById('todoCategory').value;
    const text = input.value.trim();

    if (!text) {
        showToast('Please enter a task.', 'error');
        input.focus();
        return;
    }

    const todo = {
        id: Date.now(),
        text,
        priority,
        category,
        done: false,
        createdAt: new Date().toISOString()
    };

    todos.unshift(todo);
    saveTodos();
    input.value = '';
    document.getElementById('todoPriority').value = 'normal';
    document.getElementById('todoCategory').value = 'general';
    renderTodoList();
    showToast('✅ Task added!', 'success');
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    todo.completedAt = todo.done ? new Date().toISOString() : null;
    saveTodos();
    renderTodoList();
}

function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodoList();
    showToast('Task removed.', 'warning');
}

function clearDoneTodos() {
    const doneCount = todos.filter(t => t.done).length;
    if (doneCount === 0) { showToast('No completed tasks to clear.', 'info'); return; }
    todos = todos.filter(t => !t.done);
    saveTodos();
    renderTodoList();
    showToast(`🧹 Cleared ${doneCount} completed task${doneCount !== 1 ? 's' : ''}.`, 'success');
}

function filterTodos(filter) {
    todoFilter = filter;
    // Update tab active states
    ['all', 'pending', 'done'].forEach(f => {
        const tab = document.getElementById(`tab-${f}`);
        if (tab) tab.classList.toggle('active', f === filter);
    });
    renderTodoList();
}

function getTodoPriorityMeta(priority) {
    const map = {
        high: { label: 'High', icon: '🔴', cls: 'priority-high' },
        normal: { label: 'Normal', icon: '🔵', cls: 'priority-normal' },
        low: { label: 'Low', icon: '⚪', cls: 'priority-low' }
    };
    return map[priority] || map.normal;
}

function getTodoCategoryMeta(category) {
    const map = {
        general:  { label: 'General',  icon: '📋' },
        work:     { label: 'Work Task', icon: '💼' },
        learning: { label: 'Learning',  icon: '📚' },
        admin:    { label: 'Admin',     icon: '🗂️' },
        meeting:  { label: 'Meeting',   icon: '🤝' }
    };
    return map[category] || map.general;
}

function renderTodoList() {
    const list = document.getElementById('todoList');
    const empty = document.getElementById('todoEmpty');
    if (!list) return;

    // Update stats
    const total = todos.length;
    const done = todos.filter(t => t.done).length;
    const pending = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const statTotal = document.getElementById('todoStatTotal');
    const statPending = document.getElementById('todoStatPending');
    const statDone = document.getElementById('todoStatDone');
    const progressFill = document.getElementById('todoProgressFill');
    const progressLabel = document.getElementById('todoProgressLabel');

    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statDone) statDone.textContent = done;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressLabel) progressLabel.textContent = `${pct}% complete`;

    // Filter
    let filtered = todos;
    if (todoFilter === 'pending') filtered = todos.filter(t => !t.done);
    if (todoFilter === 'done')    filtered = todos.filter(t => t.done);

    if (filtered.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = filtered.map(todo => {
        const pri = getTodoPriorityMeta(todo.priority);
        const cat = getTodoCategoryMeta(todo.category);
        const dateStr = todo.createdAt
            ? new Date(todo.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
            : '';
        return `
        <div class="todo-item ${todo.done ? 'todo-done' : ''} ${pri.cls}" data-id="${todo.id}">
            <button class="todo-check-btn" onclick="toggleTodo(${todo.id})" title="${todo.done ? 'Mark as pending' : 'Mark as done'}">
                <i class="fa-${todo.done ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
            </button>
            <div class="todo-item-body">
                <span class="todo-item-text ${todo.done ? 'todo-text-done' : ''}">${escapeHtml(todo.text)}</span>
                <div class="todo-item-meta">
                    <span class="todo-cat-tag">${cat.icon} ${cat.label}</span>
                    <span class="todo-pri-tag ${pri.cls}">${pri.icon} ${pri.label}</span>
                    ${dateStr ? `<span class="todo-date-tag"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>` : ''}
                    ${todo.done && todo.completedAt ? `<span class="todo-done-tag"><i class="fa-solid fa-check"></i> Done</span>` : ''}
                </div>
            </div>
            <button class="todo-delete-btn" onclick="deleteTodo(${todo.id})" title="Delete task">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }).join('');
}

// ==================== ACHIEVEMENTS / TROPHY CASE ====================
function loadAchievements() {
    try {
        const stored = safeLocalStorage.getItem(ACHIEVEMENTS_KEY);
        unlockedAchievements = stored ? JSON.parse(stored) : [];
    } catch (e) {
        unlockedAchievements = [];
    }
}

function saveAchievements() {
    safeLocalStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
}

function checkAchievements() {
    let newlyUnlocked = false;

    // Calculate metrics
    const totalMins = typeof getTotalMinutes === 'function' ? getTotalMinutes() : 0;
    const totalHours = totalMins / 60;
    const uniqueDays = new Set(records.map(r => r.date)).size;
    const doneTasks = todos.filter(t => t.done).length;

    // Helper to unlock
    const unlock = (id) => {
        if (!unlockedAchievements.includes(id)) {
            unlockedAchievements.push(id);
            newlyUnlocked = true;
            
            // Show toast for newly unlocked badge
            const badgeInfo = ACHIEVEMENTS_LIST.find(a => a.id === id);
            if (badgeInfo) {
                showToast(`🏆 Achievement Unlocked: ${badgeInfo.title}!`, 'success');
            }
        }
    };

    // 1. First log
    if (records.length > 0) unlock('first_log');
    
    // 2. Task Master (10 tasks)
    if (doneTasks >= 10) unlock('tasks_10');
    
    // 3. Dedicated (7 unique days)
    if (uniqueDays >= 7) unlock('days_7');
    
    // 4. Half Century (50 hours)
    if (totalHours >= 50) unlock('hours_50');
    
    // 5. Century Club (100 hours)
    if (totalHours >= 100) unlock('hours_100');
    
    // 6. Finish Line (240 hours)
    if (totalHours >= REQUIRED_HOURS) unlock('hours_240');

    if (newlyUnlocked) {
        saveAchievements();
    }
    
    renderAchievements();
}

function renderAchievements() {
    const grid = document.getElementById('badgesGrid');
    const subtitle = document.getElementById('trophySubtitle');
    if (!grid) return;

    if (subtitle) {
        subtitle.textContent = `${unlockedAchievements.length} / ${ACHIEVEMENTS_LIST.length} Unlocked`;
    }

    grid.innerHTML = ACHIEVEMENTS_LIST.map(badge => {
        const isUnlocked = unlockedAchievements.includes(badge.id);
        const stateClass = isUnlocked ? 'unlocked' : 'locked';
        
        return `
            <div class="badge-item ${stateClass}">
                <div class="badge-icon-wrap">
                    <i class="${badge.icon}"></i>
                </div>
                <div class="badge-title">${badge.title}</div>
                <div class="badge-desc">${badge.desc}</div>
                ${isUnlocked ? '<div class="badge-date">UNLOCKED</div>' : ''}
            </div>
        `;
    }).join('');
}
