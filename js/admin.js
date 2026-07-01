// ==================== ADMIN PORTAL LOGIC ====================

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

let allInterns = [];
let selectedInternId = null;
let currentActiveTab = 'profile'; // 'profile' or 'logs'
let currentSidebarDept = 'all';
let currentStatusFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check via backend
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            window.location.href = 'index.html';
            return;
        }
        const data = await res.json();
        if (data.user.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
    } catch (e) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Load Intern Data
    loadInternsData();
});

// Helper: Generate Mock Records
function generateMockRecords(totalMins, lastActiveDateStr, dept) {
    const records = [];
    let minsLeft = totalMins;
    let currentDate = new Date(lastActiveDateStr);
    
    const tasksMap = {
        'Intelligent Systems': [
            'Worked on training data pipeline for model testing.',
            'Refactored neural net preprocessing functions.',
            'Fixed bugs in the edge device streaming demo.',
            'Participated in weekly system architecture review.',
            'Documented API endpoints for model inference.'
        ],
        'Marketing & Comms': [
            'Created social media calendar for upcoming campaign.',
            'Designed brand assets and slide deck templates.',
            'Drafted press release for community outreach event.',
            'Conducted content performance review for newsletter.',
            'Prepared marketing analytics dashboard.'
        ],
        'Business Dev': [
            'Researched potential partner organizations.',
            'Updated lead pipeline database and notes.',
            'Attended strategy meeting and drafted minutes.',
            'Prepared proposal slides for regional outreach.',
            'Reviewed market analysis documents.'
        ],
        'Operations': [
            'Audited system log files and inventory sheets.',
            'Assisted in coordination of volunteer schedule.',
            'Updated project management timeline and milestones.',
            'Organized digital document repository.',
            'Drafted standard operating procedure guidelines.'
        ]
    };
    const defaultTasks = [
        'Completed daily task assignments and documentation.',
        'Assisted teammates on integration tests.',
        'Documented bugs and updated issues board.',
        'Attended standup and worked on project tasks.'
    ];
    const tasks = tasksMap[dept] || defaultTasks;

    while (minsLeft > 0) {
        // Skip weekends
        const day = currentDate.getDay();
        if (day === 0 || day === 6) {
            currentDate.setDate(currentDate.getDate() - 1);
            continue;
        }

        // Daily minutes (usually 8 hours/480 mins, but sometimes less for variety)
        let dailyMins = Math.min(minsLeft, 480);
        if (minsLeft > 480 && minsLeft - 480 < 60) {
            dailyMins = minsLeft;
        } else if (minsLeft > 120) {
            dailyMins = Math.min(minsLeft, (Math.floor(Math.random() * 5) + 4) * 60);
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Define time in/out based on dailyMins
        const grossMins = dailyMins + 60; // 1 hr break
        const outHour = 8 + Math.floor(grossMins / 60);
        const outMin = grossMins % 60;
        const timeIn = "08:00";
        const timeOut = `${outHour.toString().padStart(2, '0')}:${outMin.toString().padStart(2, '0')}`;
        
        records.push({
            id: 'mock-rec-' + Math.random().toString(36).substr(2, 9),
            date: dateStr,
            timeIn: timeIn,
            timeOut: timeOut,
            grossMins: grossMins,
            durationMins: dailyMins,
            task: tasks[Math.floor(Math.random() * tasks.length)],
            dept: dept,
            learning: 'Learned about best practices and practical application in the department context.',
            mood: Math.floor(Math.random() * 3) + 3, // 3 to 5 stars
            type: 'regular'
        });

        minsLeft -= dailyMins;
        currentDate.setDate(currentDate.getDate() - 1);
    }
    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadInternsData() {
    try {
        const res = await fetch('/api/admin/interns');
        if (res.ok) {
            allInterns = await res.json();
            updateDashboard();
        } else {
            console.error('Failed to load interns data');
        }
    } catch (e) {
        console.error('Error fetching interns:', e);
    }
}

function updateDashboard() {
    const REQUIRED_MINS = 240 * 60;

    // Calculate Totals
    const totalInterns = allInterns.length;
    const totalAllMins = allInterns.reduce((sum, i) => sum + i.totalMins, 0);
    
    let totalPctSum = 0;
    allInterns.forEach(i => {
        const pct = Math.min(100, (i.totalMins / REQUIRED_MINS) * 100);
        totalPctSum += pct;
    });
    const avgPct = totalInterns > 0 ? Math.round(totalPctSum / totalInterns) : 0;

    // Update DOM Widgets
    document.getElementById('adminTotalInterns').textContent = totalInterns;
    document.getElementById('adminTotalHours').textContent = minutesToHM(totalAllMins);
    document.getElementById('adminAvgCompletion').textContent = avgPct + '%';

    filterAdminInterns();
}

function renderAdminTable(internsToRender) {
    const tbody = document.getElementById('adminInternsTbody');
    const REQUIRED_MINS = 240 * 60;
    const footer = document.getElementById('tableFooter');

    if (internsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-row">No interns found matching the filters.</td></tr>`;
        if (footer) footer.textContent = `Showing 0 of ${allInterns.length} interns`;
        return;
    }

    tbody.innerHTML = internsToRender.map((intern, index) => {
        const pct = Math.min(100, Math.round((intern.totalMins / REQUIRED_MINS) * 100));
        const isDone = pct >= 100;
        
        let nameHtml = `<span class="intern-name ${intern.isReal ? 'is-real' : ''}">`;
        nameHtml += intern.isReal ? `${intern.name} <span class="you-badge">YOU</span>` : intern.name;
        nameHtml += `</span>`;

        return `
            <tr>
                <td style="color: var(--muted); font-weight: 500;">${index + 1}</td>
                <td>${nameHtml}</td>
                <td><span class="dept-pill">${intern.dept}</span></td>
                <td><span class="hours-val">${minutesToHM(intern.totalMins)}</span></td>
                <td>
                    <div class="prog-wrap">
                        <div class="prog-bar">
                            <div class="prog-fill ${isDone ? 'done' : ''}" style="width: ${pct}%;"></div>
                        </div>
                        <div class="prog-pct">${pct}% Completed</div>
                    </div>
                </td>
                <td><span class="last-active">${intern.lastActive !== 'Never' ? formatDate(intern.lastActive) : 'Never'}</span></td>
                <td style="text-align: right;">
                    <button class="view-btn" onclick="viewInternDetails('${intern.id}')">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (footer) {
        footer.textContent = `Showing ${internsToRender.length} of ${allInterns.length} interns`;
    }
}

function filterAdminInterns() {
    const q = document.getElementById('adminSearchInput').value.toLowerCase();
    
    const filtered = allInterns.filter(i => {
        // 1. Search Query (Name or School)
        const matchesQuery = i.name.toLowerCase().includes(q) || i.school.toLowerCase().includes(q);
        
        // 2. Department filter
        const matchesDept = (currentSidebarDept === 'all') || (i.dept === currentSidebarDept);
        
        // 3. Status filter
        const REQUIRED_MINS = 240 * 60;
        let matchesStatus = true;
        if (currentStatusFilter === 'completed') {
            matchesStatus = i.totalMins >= REQUIRED_MINS;
        } else if (currentStatusFilter === 'progress') {
            matchesStatus = i.totalMins < REQUIRED_MINS;
        }
        
        return matchesQuery && matchesDept && matchesStatus;
    });

    renderAdminTable(filtered);
}

function selectSidebarDept(dept) {
    currentSidebarDept = dept;
    
    // Update active class in sidebar items
    const navItems = document.querySelectorAll('#adminSidebarNav .sidebar-nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const idMap = {
        'all': 'navItemAll',
        'Engineering': 'navItemEngineering',
        'Intelligent Systems': 'navItemSystems',
        'Marketing & Comms': 'navItemMarketing',
        'Business Dev': 'navItemBiz',
        'Operations': 'navItemOps'
    };
    
    const activeId = idMap[dept];
    if (activeId) {
        document.getElementById(activeId).classList.add('active');
    }

    filterAdminInterns();
}

function selectStatusFilter(status) {
    currentStatusFilter = status;

    // Update active class on filter buttons
    const filterBtns = document.querySelectorAll('#adminStatusFilters .status-filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));

    const idMap = {
        'all': 'statusFilterAll',
        'progress': 'statusFilterInProgress',
        'completed': 'statusFilterCompleted'
    };

    const activeId = idMap[status];
    if (activeId) {
        document.getElementById(activeId).classList.add('active');
    }

    filterAdminInterns();
}

// Modal tab switcher
function switchModalTab(tabId) {
    currentActiveTab = tabId;
    
    const btnProfile = document.getElementById('modalTabBtnProfile');
    const btnLogs = document.getElementById('modalTabBtnLogs');
    
    if (tabId === 'profile') {
        btnProfile.classList.add('active');
        btnLogs.classList.remove('active');
    } else {
        btnProfile.classList.remove('active');
        btnLogs.classList.add('active');
    }
    
    renderModalContent();
}

function viewInternDetails(id) {
    selectedInternId = id;
    currentActiveTab = 'profile'; // Reset to profile overview tab

    // Hook up export button click in footer
    const exportBtn = document.getElementById('modalExportBtn');
    if (exportBtn) {
        exportBtn.setAttribute('onclick', `printInternDTR('${id}')`);
    }

    // Set active tab classes
    document.getElementById('modalTabBtnProfile').classList.add('active');
    document.getElementById('modalTabBtnLogs').classList.remove('active');

    renderModalContent();
    document.getElementById('internDetailsModal').classList.add('open');
}

function renderModalContent() {
    const intern = allInterns.find(i => i.id === selectedInternId);
    if (!intern) return;

    const content = document.getElementById('adminInternDetailsContent');
    const pct = Math.min(100, Math.round((intern.totalMins / (240 * 60)) * 100));

    // Update tab label count for logs
    const logsTabBtn = document.getElementById('modalTabBtnLogs');
    if (logsTabBtn) {
        logsTabBtn.innerHTML = `<i class="fa-solid fa-calendar-alt"></i> Attendance Logs (${intern.records.length})`;
    }

    if (currentActiveTab === 'profile') {
        content.innerHTML = `
            <div class="modal-tab-content active">
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-user"></i> Name</span>
                    <span class="detail-val" style="color: var(--yellow); font-weight: bold;">${intern.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-graduation-cap"></i> School</span>
                    <span class="detail-val">${intern.school}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-building"></i> Department</span>
                    <span class="detail-val">${intern.dept}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-clock"></i> Total Logged</span>
                    <span class="detail-val"><strong>${minutesToHM(intern.totalMins)}</strong> / 240h</span>
                </div>
                <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 0.5rem;">
                    <span class="detail-label"><i class="fa-solid fa-chart-pie"></i> Progress</span>
                    <div class="modal-prog-wrap">
                        <div class="modal-prog-bar">
                            <div class="modal-prog-fill ${pct >= 100 ? 'done' : ''}" style="width: ${pct}%;"></div>
                        </div>
                        <div class="modal-prog-label" style="font-size: 11px; text-align: right; margin-top: 2px;">${pct}% Complete</div>
                    </div>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-calendar-check"></i> Last Active</span>
                    <span class="detail-val">${intern.lastActive !== 'Never' ? formatDate(intern.lastActive) : 'Never'}</span>
                </div>
                
                <!-- Manual Attendance Log Adjustment Form -->
                <div style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                    <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--yellow); margin-bottom: 0.25rem;"><i class="fa-solid fa-user-gear"></i> Manual Log Adjustment</h4>
                    <p style="font-size: 0.75rem; color: var(--muted); margin-bottom: 0.75rem;">Manually add an attendance record for this intern.</p>
                    
                    <form onsubmit="handleManualLogSubmit(event)">
                        <div class="adj-form-grid">
                            <div class="adj-form-group">
                                <label for="adjDate">Date</label>
                                <input type="date" id="adjDate" class="adj-input" required value="${new Date().toISOString().split('T')[0]}" />
                            </div>
                            <div class="adj-form-group">
                                <label for="adjTimeIn">Time In</label>
                                <input type="time" id="adjTimeIn" class="adj-input" required value="08:00" />
                            </div>
                            <div class="adj-form-group">
                                <label for="adjTimeOut">Time Out</label>
                                <input type="time" id="adjTimeOut" class="adj-input" required value="17:00" />
                            </div>
                            <div class="adj-form-group">
                                <label for="adjMood">Mood Rating</label>
                                <select id="adjMood" class="adj-input">
                                    <option value="5">🌟 5 Stars</option>
                                    <option value="4">😊 4 Stars</option>
                                    <option value="3">🙂 3 Stars</option>
                                    <option value="2">😐 2 Stars</option>
                                    <option value="1">😞 1 Star</option>
                                </select>
                            </div>
                        </div>
                        <div class="adj-form-group" style="margin-top: 0.75rem;">
                            <label for="adjTask">Activity / Task Description</label>
                            <input type="text" id="adjTask" class="adj-input" placeholder="e.g. Completed documentation, assisted on QA tests..." required />
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
                            <button type="submit" class="adj-submit-btn">
                                <i class="fa-solid fa-check"></i> Add Attendance Record
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    } else {
        // Render Attendance Logs Tab
        const tbodyRows = intern.records.length === 0
            ? `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 2rem;">No logs recorded.</td></tr>`
            : intern.records.map(r => {
                const dayOfWeek = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                return `
                    <tr>
                        <td style="font-weight: 600;">${formatDate(r.date)} <span style="font-size: 10px; color: var(--muted); font-weight: normal; margin-left: 2px;">(${dayOfWeek})</span></td>
                        <td>${formatTime(r.timeIn)}</td>
                        <td>${formatTime(r.timeOut)}</td>
                        <td style="font-weight: bold; color: var(--yellow);">${minutesToHM(r.durationMins)}</td>
                        <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.task)}">${escapeHtml(r.task)}</td>
                        <td style="text-align: right;">
                            <button class="modal-close" style="width: 26px; height: 26px; border-radius: 6px; display: inline-flex;" onclick="deleteInternRecord('${intern.id}', '${r.id}')" title="Delete record">
                                <i class="fa-solid fa-trash" style="color: var(--danger); font-size: 0.75rem;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        content.innerHTML = `
            <div class="modal-tab-content active">
                <h4 style="font-size: 0.90rem; font-weight: 700; color: var(--yellow); margin-bottom: 0.5rem;"><i class="fa-solid fa-clock-rotate-left"></i> Daily Log History</h4>
                
                <div class="modal-log-table-wrap">
                    <table class="modal-log-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Net Hours</th>
                                <th>Activity</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tbodyRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

async function deleteInternRecord(internId, recordId) {
    const intern = allInterns.find(i => i.id === internId);
    if (!intern) return;

    if (!confirm('Are you sure you want to delete this attendance record?')) return;

    try {
        const res = await fetch(`/api/admin/records/${recordId}`, { method: 'DELETE' });
        if (res.ok) {
            intern.records = intern.records.filter(r => r.id !== recordId);
            intern.totalMins = intern.records.reduce((sum, r) => sum + (parseInt(r.durationMins) || 0), 0);
            if (intern.records.length > 0) {
                const sorted = [...intern.records].sort((a, b) => new Date(b.date) - new Date(a.date));
                intern.lastActive = sorted[0].date;
            } else {
                intern.lastActive = 'Never';
            }
            updateDashboard();
            renderModalContent();
        } else {
            alert('Failed to delete record from backend.');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting record.');
    }
}

async function handleManualLogSubmit(e) {
    e.preventDefault();
    const intern = allInterns.find(i => i.id === selectedInternId);
    if (!intern) return;

    const date = document.getElementById('adjDate').value;
    const timeIn = document.getElementById('adjTimeIn').value;
    const timeOut = document.getElementById('adjTimeOut').value;
    const task = document.getElementById('adjTask').value.trim();
    const mood = parseInt(document.getElementById('adjMood').value);

    if (!date || !timeIn || !timeOut || !task) {
        alert('Please fill out all fields.');
        return;
    }

    const inM = getEffectiveTimeIn(timeIn);
    const outM = toMinutes(timeOut);
    if (outM <= inM) {
        alert('Time Out must be after Time In.');
        return;
    }

    const grossMins = outM - inM;
    const durationMins = grossMins > 60 ? grossMins - 60 : grossMins;

    const newRecord = {
        id: 'rec-' + Date.now(),
        user_id: intern.id,
        date: date,
        timeIn: timeIn,
        timeOut: timeOut,
        grossMins: grossMins,
        durationMins: durationMins,
        task: task,
        dept: intern.dept,
        learning: 'Manually adjusted by System Admin.',
        mood: mood,
        type: 'regular'
    };

    try {
        const res = await fetch('/api/admin/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord)
        });
        
        if (res.ok) {
            intern.records.push(newRecord);
            intern.records.sort((a, b) => new Date(b.date) - new Date(a.date));
            intern.totalMins = intern.records.reduce((sum, r) => sum + (parseInt(r.durationMins) || 0), 0);
            intern.lastActive = intern.records[0].date;

            alert(`Success: Record for ${formatDate(date)} (${minutesToHM(durationMins)}) added.`);
            updateDashboard();
            renderModalContent();
        } else {
            alert('Failed to save record to backend.');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving record.');
    }
}

function closeInternDetails() {
    document.getElementById('internDetailsModal').classList.remove('open');
    selectedInternId = null;
}

// DTR PDF PRINTING LOGIC
function printInternDTR(id) {
    const intern = allInterns.find(i => i.id === id);
    if (!intern) return;

    if (intern.records.length === 0) {
        alert('No attendance records available to export for this intern.');
        return;
    }

    const REQUIRED_HOURS = 240;
    const totalMins = intern.totalMins;
    const remainingMins = Math.max(0, REQUIRED_HOURS * 60 - totalMins);
    const pct = Math.min(100, Math.round((totalMins / (REQUIRED_HOURS * 60)) * 100));
    const days = intern.records.length;
    const avg = days > 0 ? Math.round(totalMins / days) : 0;

    const tableRows = intern.records.map((r, i) => {
        const dateStr = formatDate(r.date);
        const timeInStr = formatTime(r.timeIn);
        const timeOutStr = formatTime(r.timeOut);
        const dayType = r.type === 'regular' ? 'Regular' : (r.type || 'Regular');
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

            <table class="info-table">
                <tr>
                    <td class="label">Intern Name</td>
                    <td class="value"><strong>${intern.name}</strong></td>
                    <td class="label">Intern ID</td>
                    <td class="value">${intern.id === 'local' ? (safeLocalStorage.getItem('p4a_intern_id') || 'P4A-2026-001') : 'P4A-2026-M' + intern.id.substring(1)}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">${intern.dept}</td>
                    <td class="label">School</td>
                    <td class="value">${intern.school}</td>
                </tr>
            </table>

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
                        <td><strong>${(totalMins/60).toFixed(1)} hrs</strong></td>
                        <td>${REQUIRED_HOURS.toFixed(1)} hrs</td>
                        <td><strong>${(remainingMins/60).toFixed(1)} hrs</strong></td>
                        <td>${days} days</td>
                        <td>${minutesToHM(avg)}</td>
                        <td><strong>${pct}%</strong></td>
                    </tr>
                </tbody>
            </table>

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

            <div class="sign-off-block">
                <div class="certification-statement">
                    I hereby certify on my honor that the daily attendance logs, clocked hours, and descriptions of tasks completed herein are a true, accurate, and faithful record of my actual hours served during my internship training at <strong>POWER 4 ALL, Inc.</strong>
                </div>
                <div class="signature-layout">
                    <div class="signature-column">
                        <span class="signature-label">Prepared By (Intern)</span>
                        <div class="signature-line"></div>
                        <span class="printed-name">${intern.name}</span>
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

function downloadRosterSummary() {
    if (allInterns.length === 0) {
        alert('No interns available in roster.');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Index,Intern Name,Department,School,Total Hours Logged,Progress %,Last Active Date,Status\r\n';

    const REQUIRED_MINS = 240 * 60;
    allInterns.forEach((intern, index) => {
        const totalHrs = (intern.totalMins / 60).toFixed(2);
        const pct = Math.min(100, Math.round((intern.totalMins / REQUIRED_MINS) * 100));
        const status = intern.totalMins >= REQUIRED_MINS ? 'Completed' : 'In Progress';
        
        const row = [
            index + 1,
            `"${intern.name.replace(/"/g, '""')}"`,
            `"${intern.dept.replace(/"/g, '""')}"`,
            `"${intern.school.replace(/"/g, '""')}"`,
            totalHrs,
            `${pct}%`,
            intern.lastActive,
            status
        ].join(',');
        csvContent += row + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'POWER_4_ALL_Intern_Roster_Summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function adminLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch(e) {
        console.error(e);
    }
    window.location.href = 'index.html';
}

// UTILS
function minutesToHM(mins) {
    if (isNaN(mins) || mins < 0) return '0h 00m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function getEffectiveTimeIn(timeIn) {
    let inM = toMinutes(timeIn);
    if (!inM) return 0;
    
    // Earliest shift is 7:00 AM (420 mins)
    if (inM < 420) inM = 420;
    
    // Round up to nearest 30 mins
    const remainder = inM % 30;
    if (remainder > 0) {
        inM += (30 - remainder);
    }
    return inM;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ==================== ACCOUNT MANAGEMENT ====================
let allAdminUsers = [];

function showAccountManagement() {
    // UI Tab selection
    document.querySelectorAll('#adminSidebarNav .sidebar-nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('navItemAccounts').classList.add('active');

    // Show correct pane
    document.getElementById('internsOverviewPane').style.display = 'none';
    document.getElementById('accountManagementPane').style.display = 'block';

    // Update Topbar
    document.getElementById('topbarTitleH1').textContent = 'Account Management';
    document.getElementById('topbarTitleP').textContent = 'Manage Administrator and Member accounts.';

    loadAdminUsers();
}

// Override selectSidebarDept to show interns pane again
const originalSelectSidebarDept = selectSidebarDept;
window.selectSidebarDept = function(dept) {
    document.getElementById('accountManagementPane').style.display = 'none';
    document.getElementById('internsOverviewPane').style.display = 'block';
    
    document.getElementById('topbarTitleH1').textContent = 'Interns Overview';
    document.getElementById('topbarTitleP').textContent = 'Monitor progress and track hours for all active interns.';
    
    document.getElementById('navItemAccounts').classList.remove('active');
    originalSelectSidebarDept(dept);
};

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
            allAdminUsers = await res.json();
            renderAdminUsersTable(allAdminUsers);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTbody');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No accounts found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const roleDisplay = u.role === 'admin' ? 'Administrator' : 'Member';
        const pillBg = u.role === 'admin' ? 'rgba(245, 197, 24, 0.15)' : 'rgba(74, 222, 128, 0.15)';
        const pillColor = u.role === 'admin' ? 'var(--yellow)' : 'var(--success)';
        
        return `
            <tr>
                <td style="font-weight: 500; color: var(--text);">${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.dept)}</td>
                <td style="color: var(--muted);">${escapeHtml(u.email)}</td>
                <td><span class="dept-pill" style="background: ${pillBg}; color: ${pillColor}; border: 1px solid ${pillColor};">${roleDisplay}</span></td>
                <td style="text-align: right;">
                    <button class="modal-close" style="width: 26px; height: 26px; border-radius: 6px; display: inline-flex;" onclick="deleteAdminUser('${u.id}')" title="Delete account">
                        <i class="fa-solid fa-trash" style="color: var(--danger); font-size: 0.75rem;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAdminUsers() {
    const q = document.getElementById('adminUsersSearchInput').value.toLowerCase();
    const filtered = allAdminUsers.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) || 
        u.dept.toLowerCase().includes(q)
    );
    renderAdminUsersTable(filtered);
}

function openAddAccountModal() {
    document.getElementById('addAccountForm').reset();
    document.getElementById('addAccountModal').classList.add('open');
}

function closeAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('open');
}

async function handleAddAccountSubmit(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('accName').value,
        email: document.getElementById('accEmail').value,
        dept: document.getElementById('accDept').value,
        role: document.getElementById('accRole').value,
        password: document.getElementById('accPass').value
    };

    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('Account created successfully.');
            closeAddAccountModal();
            loadAdminUsers();
        } else {
            alert(data.error || 'Failed to create account.');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred.');
    }
}

async function deleteAdminUser(id) {
    if (!confirm('Are you sure you want to delete this account?')) return;
    
    try {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            loadAdminUsers();
        } else {
            alert(data.error || 'Failed to delete account.');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred.');
    }
}
