const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    alert("Unauthorized Access. Admin privileges required.");
    window.location.href = 'login.html';
}

let roomList = [];
let allBookings = [];
let allTimetables = [];
let filterStatus = 'Pending'; 
let searchQuery = '';
const statusUpdateInFlight = new Set();

const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00"
];
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseStatus(rawStatus) {
    if (!rawStatus) return { status: "Pending", reason: "" };
    if (rawStatus.includes("ไม่อนุมัติ") || rawStatus.includes("Rejected") || rawStatus.includes("Declined")) {
        let reason = "";
        if (rawStatus.includes(":")) reason = rawStatus.split(":").slice(1).join(":").trim();
        return { status: "Declined", reason: reason };
    }
    if (rawStatus.includes("อนุมัติแล้ว") || rawStatus.includes("Approved")) return { status: "Approved", reason: "" };
    return { status: "Pending", reason: "" };
}

function populateTimeDropdowns(startId, endId) {
    const stSelect = document.getElementById(startId);
    const etSelect = document.getElementById(endId);
    if (!stSelect || !etSelect) return;
    
    stSelect.innerHTML = '<option value="">-- Start --</option>';
    etSelect.innerHTML = '<option value="">-- End --</option>';
    
    const endSlots = [...timeSlots, "21:30"];
    
    timeSlots.forEach(t => stSelect.innerHTML += `<option value="${t}">${t}</option>`);
    endSlots.forEach(t => { if(t !== "08:00") etSelect.innerHTML += `<option value="${t}">${t}</option>`; });
}

window.onload = function() {
    const style = document.createElement('style');
    style.innerHTML = `
        body { overflow-x: hidden; }
        .fix-overflow { min-width: 0 !important; max-width: 100% !important; width: 100% !important; }
        .scroll-wrapper { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sticky-col { position: sticky; left: 0; z-index: 30; background-color: #f9fafb; }
        .sticky-col-white { position: sticky; left: 0; z-index: 20; background-color: #ffffff; }
        .sticky-col::after, .sticky-col-white::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 5px; box-shadow: inset -4px 0 6px -3px rgba(0,0,0,0.1); pointer-events: none; }
        .schedule-cell {
            padding: 6px;
            vertical-align: top;
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            border-left: 1px solid #e5e7eb;
        }
        .schedule-event {
            min-height: 58px;
            height: 100%;
            padding: 9px 10px 8px 11px;
            border: 1px solid #d9dee8;
            border-left-width: 3px;
            border-radius: 4px;
            background: #f8fafc;
            box-shadow: none;
            overflow: hidden;
        }
        .schedule-event--class {
            border-left-color: #9a6b1f;
            background: #fbfaf6;
        }
        .schedule-event--booking {
            border-left-color: #2f477f;
            background: #f4f6fb;
        }
        .schedule-event__title {
            margin: 0;
            color: #1f2937;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.35;
        }
        .schedule-event__meta {
            margin-top: 3px;
            color: #5f6b7a;
            font-size: 10px;
            font-weight: 500;
            line-height: 1.35;
        }
        .schedule-event__detail {
            margin-top: 5px;
            color: #475467;
            font-size: 10px;
            font-weight: 400;
            line-height: 1.4;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
    `;
    document.head.appendChild(style);

    const containers = ['content-management', 'content-room-status', 'content-admin-book', 'admin-table-container', 'admin-timetable-container'];
    containers.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('fix-overflow'); });

    document.getElementById('admin-display').innerText = `Admin: ${currentUser.name}`;
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('admin-view-date');
    if(dateInput) { dateInput.value = today; dateInput.addEventListener('change', () => loadAdminSchedule(false)); }
    
    const adminDateInput = document.getElementById('admin-date');
    if (adminDateInput) adminDateInput.value = today; 

    const adminNameInput = document.getElementById('admin-name');
    if (adminNameInput) {
        adminNameInput.value = currentUser.name;
        document.getElementById('admin-staffId').value = currentUser.id;
    }

    populateTimeDropdowns('admin-startTime', 'admin-endTime');
    
    // โหลดครั้งแรกแบบแสดง Animation โหลด
    loadAdminSchedule(false);

    // วนลูป Auto-sync โหลดเฉพาะการจอง ทุกๆ 60 วินาทีแบบเงียบๆ
    setInterval(() => { loadAdminSchedule(true); }, 60000);
};

function switchAdminTab(tabName) {
    const tabs = ['management', 'room-status', 'admin-book'];
    const activeClass = "py-3 px-6 font-bold text-sm border-b-2 border-indigo-600 text-indigo-700 focus:outline-none uppercase tracking-wide whitespace-nowrap transition-colors";
    const inactiveClass = "py-3 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 focus:outline-none uppercase tracking-wide whitespace-nowrap transition-colors";

    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        const content = document.getElementById(`content-${tab}`);
        if (!btn || !content) return;

        if (tab === tabName) {
            btn.className = activeClass;
            content.classList.remove('hidden');
        } else {
            btn.className = inactiveClass;
            content.classList.add('hidden');
        }
    });
}

// 💡 ฟังก์ชันนี้ถูกจัดวงเล็บใหม่ให้สมบูรณ์แล้ว
async function loadAdminSchedule(isSilent = false) {
    const tableContainer = document.getElementById('admin-table-container');
    const gridContainer = document.getElementById('admin-timetable-container');

    if (!isSilent) {
        const loadingHTML = `
            <div class="py-16 flex flex-col justify-center items-center animate-in fade-in duration-500">
                <div class="relative flex justify-center items-center w-20 h-20 mb-6">
                    <div class="absolute inset-0 border-[1.5px] border-gray-200 rounded-full"></div>
                    <div class="absolute inset-0 border-[1.5px] border-t-indigo-800 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    <img src="logo.png" alt="Logo" class="w-11 h-11 object-contain opacity-90">
                </div>
                <div class="text-center flex flex-col items-center">
                    <p class="text-gray-800 font-bold tracking-[0.2em] text-[10px] uppercase mb-2">Synchronizing</p>
                    <div class="flex space-x-1.5 mb-3">
                        <div class="w-1 h-1 bg-indigo-800 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
                        <div class="w-1 h-1 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.15s;"></div>
                        <div class="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style="animation-delay: 0.3s;"></div>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium tracking-wide">กำลังเตรียมข้อมูล...</p>
                </div>
            </div>
        `;
        tableContainer.innerHTML = loadingHTML;
        gridContainer.innerHTML = loadingHTML;
    }

    try {
        const fetchUrl = isSilent ? `${API_URL}?type=bookings_only` : API_URL;
        const response = await fetch(fetchUrl);
        const result = await response.json();

        if (result.status === "success") {
            allBookings = result.data || [];
            
            if (!isSilent) {
                allTimetables = result.timetable || []; 
                const fetchedRooms = result.rooms || [];
                
                roomList = fetchedRooms.map(r => r.RoomName).filter(Boolean);
                
                const adminRoomSelect = document.getElementById('admin-room');
                if (adminRoomSelect) {
                    adminRoomSelect.innerHTML = '<option value="">-- Select Room --</option>';
                    roomList.forEach(r => adminRoomSelect.innerHTML += `<option value="${r}">${r}</option>`);
                }
            }

            renderManagementTable();
            renderTimetableGrid();
            
        } else {
            if (!isSilent) {
                tableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200">Error: ${result.message}</p>`;
            }
        }
    } catch (error) {
        if (!isSilent) {
            tableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200">Connection failed. Please refresh the page.</p>`;
        }
    }
}

function renderManagementTable() {
    const tableContainer = document.getElementById('admin-table-container');
    
    let filtered = allBookings.filter(b => {
        let matchStatus = true;
        const parsed = parseStatus(b.Status);
        if (filterStatus !== 'All') matchStatus = (parsed.status === filterStatus);

        let matchSearch = true;
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            matchSearch = (b.Name && b.Name.toLowerCase().includes(q)) || 
                          (b.ID && b.ID.toLowerCase().includes(q)) || 
                          (b.ID_RESERVE && b.ID_RESERVE.toLowerCase().includes(q)) ||
                          (b.Room && b.Room.toLowerCase().includes(q));
        }
        return matchStatus && matchSearch;
    });

    if (filterStatus === 'Pending') filtered.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    else filtered.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    let html = `
        <div class="mb-5 flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div class="w-full md:w-1/2 relative">
                <input type="text" placeholder="Search by Lecturer, ID, or Request ID..." 
                    class="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
                    value="${searchQuery}" onkeyup="handleSearch(this.value)">
                <span class="absolute left-3 top-3 text-gray-400">🔍</span>
            </div>
            <div class="w-full md:w-auto flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                <button onclick="setFilter('All')" class="px-5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shadow-sm ${filterStatus === 'All' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50'}">All Requests</button>
                <button onclick="setFilter('Pending')" class="px-5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shadow-sm ${filterStatus === 'Pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 hover:bg-amber-50'}">Pending</button>
                <button onclick="setFilter('Approved')" class="px-5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shadow-sm ${filterStatus === 'Approved' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 hover:bg-emerald-50'}">Approved</button>
                <button onclick="setFilter('Declined')" class="px-5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shadow-sm ${filterStatus === 'Declined' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 hover:bg-rose-50'}">Declined</button>
            </div>
        </div>
    `;

    if (filtered.length === 0) {
        html += '<div class="p-10 bg-gray-50 rounded-xl text-center border border-dashed border-gray-300"><p class="text-gray-500 font-medium">No records found matching your criteria.</p></div>';
    } else {
        html += `<div class="scroll-wrapper border border-gray-200 rounded-xl shadow-sm bg-white pb-2">
            <table class="w-full min-w-max divide-y divide-gray-200 text-left text-sm border-collapse">
                <thead class="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                        <th class="px-5 py-4 border-b border-gray-200 whitespace-nowrap">Submitted</th>
                        <th class="px-5 py-4 border-b border-gray-200 min-w-[180px]">Requester</th>
                        <th class="px-5 py-4 border-b border-gray-200 min-w-[180px]">Room & Schedule</th>
                        <th class="px-5 py-4 border-b border-gray-200 min-w-[250px] max-w-sm">Purpose</th>
                        <th class="px-5 py-4 border-b border-gray-200 text-center whitespace-nowrap">Status</th>
                        <th class="px-5 py-4 border-b border-gray-200 text-center min-w-[160px]">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

        filtered.forEach(booking => {
            const parsed = parseStatus(booking.Status);
            let statusBadge = ""; 
            if (parsed.status === "Approved") statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
            else if (parsed.status === "Declined") statusBadge = "bg-rose-100 text-rose-800 border-rose-200";
            else statusBadge = "bg-amber-100 text-amber-800 border-amber-200";

            let actionButtons = "";
            if (parsed.status === "Pending") {
                actionButtons = `<div class="flex flex-wrap gap-2 justify-center">
                                    <button onclick="updateStatus('${booking.ID_RESERVE}', 'อนุมัติแล้ว')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-[11px] font-bold transition-colors shadow-sm flex-1 min-w-[70px]">Approve</button>
                                    <button onclick="openDeclineModal('${booking.ID_RESERVE}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-[11px] font-bold transition-colors shadow-sm flex-1 min-w-[70px]">Decline</button>
                                 </div>`;
            } else {
    actionButtons = `
        <div class="flex flex-col gap-2 justify-center">

            <button
                onclick="openEmailPreview('${booking.ID_RESERVE}')"
                class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap">
                ✉ Preview Email
            </button>

            <button
                onclick="updateStatus('${booking.ID_RESERVE}', 'รออนุมัติ')"
                class="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-[11px] font-bold transition-colors shadow-sm whitespace-nowrap">
                ↺ Undo Action
            </button>

        </div>`;
}

            let timeStr = "N/A";
            if (booking.Timestamp) {
                const t = new Date(booking.Timestamp);
                if(!isNaN(t)) timeStr = t.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            }
            
            let reasonDisplay = booking.Reason;
            if (parsed.reason) {
                reasonDisplay += `<br><span class="inline-block mt-2 px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded border border-red-100 font-semibold">Declined Reason: ${parsed.reason}</span>`;
            }

            html += `<tr class="hover:bg-indigo-50/30 transition-colors">
                <td class="px-5 py-4 align-top">
                    <div class="text-xs font-semibold text-gray-700">${timeStr}</div>
                    <div class="text-[10px] text-gray-400 mt-1 font-mono">ID: ${booking.ID_RESERVE}</div>
                </td>
                <td class="px-5 py-4 align-top">
                    <div class="text-sm font-bold text-gray-900">${booking.Name}</div>
                    <div class="text-xs text-gray-500 mt-1">${booking.ID}</div>
                </td>
                <td class="px-5 py-4 align-top">
                    <div class="font-bold text-indigo-700 text-sm">${booking.Room}</div>
                    <div class="text-xs text-gray-600 mt-1 font-medium">${booking.Date} &bull; <span class="font-mono text-gray-800">${booking.TimeRange}</span></div>
                </td>
                <td class="px-5 py-4 align-top text-xs text-gray-600 leading-relaxed break-words max-w-sm">${reasonDisplay}</td>
                <td class="px-5 py-4 align-top text-center">
                    <span class="px-3 py-1.5 inline-flex text-[11px] font-bold rounded-full border ${statusBadge}">${parsed.status}</span>
                </td>
                <td class="px-5 py-4 align-top">
                    ${actionButtons}
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }
    tableContainer.innerHTML = html;
}

window.setFilter = function(status) { filterStatus = status; renderManagementTable(); }
let searchTimeout;
window.handleSearch = function(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { searchQuery = val; renderManagementTable(); }, 300); }

function renderTimetableGrid() {
    const gridContainer = document.getElementById('admin-timetable-container');
    const dateInput = document.getElementById('admin-view-date');
    if (!dateInput || !dateInput.value) return;
    const selectedDate = dateInput.value;
    const currentDayName = daysOfWeek[new Date(selectedDate + 'T00:00:00').getDay()]; 

    let gridHTML = `<div class="scroll-wrapper border border-gray-300 rounded-lg bg-white pb-2 pr-6">
        <table class="w-max min-w-full text-left bg-white border-collapse">
        <thead class="bg-gray-50 text-gray-600 font-bold text-[11px] uppercase tracking-wider">
            <tr>
                <th class="px-5 py-4 border-b border-r border-gray-200 sticky-col min-w-[140px] max-w-[140px] z-30">Room / Time</th>`;
            
    timeSlots.forEach((slot, index) => { 
        gridHTML += `<th class="border-b border-l border-gray-200 bg-gray-50 min-w-[100px] h-12 relative">
            <div class="absolute left-0 bottom-2 -translate-x-1/2 font-mono text-[11px] font-bold text-gray-500 bg-gray-50 px-1 z-0">${slot}</div>`;
        if(index === timeSlots.length - 1) {
            gridHTML += `<div class="absolute right-0 bottom-2 translate-x-1/2 font-mono text-[11px] font-bold text-gray-500 bg-gray-50 px-1 z-0">21:30</div>`;
        }
        gridHTML += `</th>`; 
    });
    gridHTML += `</tr></thead><tbody class="divide-y divide-gray-100">`;

    roomList.forEach(room => {
        gridHTML += `<tr class="hover:bg-gray-50 transition-colors">
            <td class="px-5 py-4 font-bold text-gray-800 border-b border-r border-gray-200 sticky-col-white min-w-[140px] max-w-[140px] truncate z-20" title="${room}">${room}</td>`;
        
        for (let i = 0; i < timeSlots.length; i++) {
            const slot = timeSlots[i];

            const isRegularClass = allTimetables.find(t => {
                if (t.Room !== room || t.DayOfWeek.trim().toLowerCase() !== currentDayName.toLowerCase()) return false;
                
                if (t.Start_Date && t.End_Date) {
                    const checkDate = new Date(selectedDate);
                    const startDate = new Date(t.Start_Date.trim());
                    const endDate = new Date(t.End_Date.trim());
                    checkDate.setHours(0,0,0,0); startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
                    if (checkDate < startDate || checkDate > endDate) return false;
                }

                if (t.Exception_Dates && t.Exception_Dates.includes(selectedDate)) return false; 
                const [start, end] = t.TimeRange.split(" - ");
                return slot >= start.trim() && slot < end.trim();
            });

            const isBooked = allBookings.find(b => {
                const parsed = parseStatus(b.Status);
                if (b.Room !== room || b.Date !== selectedDate || parsed.status !== "Approved") return false;
                const [start, end] = b.TimeRange.split(" - ");
                return slot >= start.trim() && slot < end.trim();
            });

            if (isRegularClass) {
                let span = 1;
                while (i + span < timeSlots.length) {
                    const nextSlot = timeSlots[i + span];
                    const [s, e] = isRegularClass.TimeRange.split(" - ");
                    if (nextSlot >= s.trim() && nextSlot < e.trim()) span++; else break;
                }
                gridHTML += `<td colspan="${span}" class="schedule-cell min-w-[${span * 100}px]">
                            <div class="schedule-event schedule-event--class" title="${isRegularClass.Course || ''}">
                                <div class="schedule-event__title">${isRegularClass.Course_ID || 'Scheduled Class'}</div>
                                <div class="schedule-event__meta">${isRegularClass.Lecturer || ''}</div>
                                <div class="schedule-event__detail">${isRegularClass.Course || ''}</div>
                            </div>
                        </td>`;
                i += (span - 1);
            } else if (isBooked) {
                let span = 1;
                while (i + span < timeSlots.length) {
                    const nextSlot = timeSlots[i + span];
                    const [s, e] = isBooked.TimeRange.split(" - ");
                    if (nextSlot >= s.trim() && nextSlot < e.trim()) span++; else break;
                }
                gridHTML += `<td colspan="${span}" class="schedule-cell min-w-[${span * 100}px]">
                            <div class="schedule-event schedule-event--booking" title="${isBooked.Reason || ''}">
                                <div class="schedule-event__title">${isBooked.Name ? isBooked.Name.split(' ')[0] : 'Reservation'}</div>
                                <div class="schedule-event__meta">Approved reservation</div>
                                <div class="schedule-event__detail">${isBooked.Reason || 'Room reservation'}</div>
                            </div>
                        </td>`;
                i += (span - 1);
            } else {
                gridHTML += `<td class="p-2 border-b border-l border-gray-100 min-w-[100px]"></td>`;
            }
        }
        gridHTML += `</tr>`;
    });
    gridHTML += `</tbody></table></div>`;
    gridContainer.innerHTML = gridHTML;
}

function showAdminToast(message, type = "success") {
    const existing = document.getElementById('admin-toast');
    if (existing) existing.remove();

    const palette = {
        success: {
            background: "#ecfdf3",
            border: "#abefc6",
            color: "#067647"
        },
        warning: {
            background: "#fffaeb",
            border: "#fedf89",
            color: "#b54708"
        },
        error: {
            background: "#fef3f2",
            border: "#fecdca",
            color: "#b42318"
        }
    };

    const selected = palette[type] || palette.success;
    const toast = document.createElement('div');

    toast.id = 'admin-toast';
    toast.setAttribute('role', 'status');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '12000';
    toast.style.maxWidth = '420px';
    toast.style.padding = '13px 16px';
    toast.style.borderRadius = '10px';
    toast.style.border = `1px solid ${selected.border}`;
    toast.style.background = selected.background;
    toast.style.color = selected.color;
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '600';
    toast.style.lineHeight = '1.55';
    toast.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.14)';
    toast.textContent = message;

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 5500);
}

function getBookingById(bookingId) {
    return allBookings.find(
        booking => booking.ID_RESERVE === bookingId
    );
}

window.openDeclineModal = function(bookingId) {
    const booking = getBookingById(bookingId);
    const modal = document.getElementById('decline-modal');

    if (!booking || !modal) {
        alert("ไม่พบข้อมูลคำขอหรือหน้าต่างปฏิเสธ กรุณารีเฟรชข้อมูลแล้วลองใหม่");
        return;
    }

    document.getElementById('decline-booking-id').value = bookingId;
    document.getElementById('decline-requester').textContent =
        booking.Name || "-";
    document.getElementById('decline-room').textContent =
        booking.Room || "-";
    document.getElementById('decline-schedule').textContent =
        `${booking.Date || "-"} • ${booking.TimeRange || "-"}`;
    document.getElementById('decline-request-id').textContent =
        booking.ID_RESERVE || "-";

    const reasonInput = document.getElementById('decline-reason');
    const errorBox = document.getElementById('decline-reason-error');

    reasonInput.value = "";
    errorBox.textContent = "";
    errorBox.classList.add('hidden');

    updateDeclineCounter();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    window.setTimeout(() => reasonInput.focus(), 50);
};

window.closeDeclineModal = function() {
    const modal = document.getElementById('decline-modal');
    const form = document.getElementById('decline-form');

    if (modal) modal.classList.add('hidden');
    if (form) form.reset();

    document.body.style.overflow = '';
};

window.updateDeclineCounter = function() {
    const input = document.getElementById('decline-reason');
    const counter = document.getElementById('decline-reason-count');

    if (input && counter) {
        counter.textContent = `${input.value.length}/300`;
    }
};

window.handleDeclineSubmit = async function(event) {
    event.preventDefault();

    const bookingId =
        document.getElementById('decline-booking-id').value.trim();
    const reasonInput =
        document.getElementById('decline-reason');
    const errorBox =
        document.getElementById('decline-reason-error');
    const submitBtn =
        document.getElementById('decline-submit-btn');

    const reason = reasonInput.value.trim();

    if (reason.length < 5) {
        errorBox.textContent =
            "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร";
        errorBox.classList.remove('hidden');
        reasonInput.focus();
        return;
    }

    errorBox.classList.add('hidden');

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "กำลังบันทึก...";

    try {
        const success = await performStatusUpdate(
            bookingId,
            `ไม่อนุมัติ: ${reason}`
        );

        if (success) closeDeclineModal();
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
};

async function updateStatus(bookingId, baseStatus) {
    if (baseStatus === 'ไม่อนุมัติ') {
        openDeclineModal(bookingId);
        return;
    }

    if (baseStatus === 'อนุมัติแล้ว' || baseStatus === 'Approved') {
        const targetBooking = getBookingById(bookingId);

        if (targetBooking) {
            const [reqStart, reqEnd] =
                targetBooking.TimeRange.split(" - ").map(value => value.trim());

            const isClashing = allBookings.find(booking => {
                if (booking.ID_RESERVE === bookingId) return false;
                if (booking.Room !== targetBooking.Room) return false;
                if (booking.Date !== targetBooking.Date) return false;
                if (parseStatus(booking.Status).status !== "Approved") return false;

                const [bookingStart, bookingEnd] =
                    booking.TimeRange.split(" - ").map(value => value.trim());

                return reqStart < bookingEnd && reqEnd > bookingStart;
            });

            if (isClashing) {
                alert(
                    "❌ ไม่สามารถอนุมัติได้\n" +
                    "เวลาซ้อนกับรายการที่อนุมัติแล้ว\n\n" +
                    `ผู้จอง: ${isClashing.Name}\n` +
                    `เวลา: ${isClashing.TimeRange}`
                );
                return;
            }
        }
    }

    const parsedStatus = parseStatus(baseStatus);
    const confirmed = confirm(
        `ยืนยันการเปลี่ยนสถานะเป็น ${parsedStatus.status} หรือไม่?`
    );

    if (!confirmed) return;

    await performStatusUpdate(bookingId, baseStatus);
}

async function performStatusUpdate(bookingId, finalStatus) {
    if (statusUpdateInFlight.has(bookingId)) return false;

    const booking = getBookingById(bookingId);
    const oldStatus = booking ? booking.Status : "";

    statusUpdateInFlight.add(bookingId);

    if (booking) {
        booking.Status = finalStatus;
        renderManagementTable();
        renderTimetableGrid();
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "updateStatus",
                id: bookingId,
                status: finalStatus,
                adminId: currentUser.id
            })
        });

        const result = await response.json();

        if (result.status !== "success") {
            throw new Error(result.message || "ไม่สามารถอัปเดตสถานะได้");
        }

        if (result.mail && result.mail.attempted) {
            if (result.mail.sent) {
                showAdminToast(
                    `อัปเดตสถานะแล้ว และส่งอีเมลถึง ${result.mail.to} สำเร็จ`,
                    "success"
                );
            } else {
                showAdminToast(
                    "อัปเดตสถานะแล้ว แต่อีเมลส่งไม่สำเร็จ: " +
                    (result.mail.error || "ไม่ทราบสาเหตุ"),
                    "warning"
                );
            }
        } else {
            showAdminToast("อัปเดตสถานะเรียบร้อยแล้ว", "success");
        }

        return true;

    } catch (error) {
        if (booking) {
            booking.Status = oldStatus;
            renderManagementTable();
            renderTimetableGrid();
        }

        showAdminToast(
            "ไม่สามารถอัปเดตสถานะ: " + error.message,
            "error"
        );

        return false;

    } finally {
        statusUpdateInFlight.delete(bookingId);
    }
}

document.getElementById('admin-booking-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reqRoom = document.getElementById('admin-room').value;
    const reqDate = document.getElementById('admin-date').value;
    const reqStart = document.getElementById('admin-startTime').value;
    const reqEnd = document.getElementById('admin-endTime').value;
    const reqDayName = daysOfWeek[new Date(reqDate + 'T00:00:00').getDay()];

    if (reqStart >= reqEnd) {
        alert("❌ Error: Start time must be earlier than End time.");
        return;
    }

    const isClashingTimetable = allTimetables.find(t => {
        if (t.Room !== reqRoom || t.DayOfWeek.trim().toLowerCase() !== reqDayName.toLowerCase()) return false;
        
        if (t.Start_Date && t.End_Date) {
            const checkDate = new Date(reqDate);
            const startDate = new Date(t.Start_Date.trim());
            const endDate = new Date(t.End_Date.trim());
            checkDate.setHours(0,0,0,0); startDate.setHours(0,0,0,0); endDate.setHours(0,0,0,0);
            if (checkDate < startDate || checkDate > endDate) return false;
        }

        if (t.Exception_Dates && t.Exception_Dates.includes(reqDate)) return false; 
        const [tStart, tEnd] = t.TimeRange.split(" - ");
        return (reqStart < tEnd.trim()) && (reqEnd > tStart.trim());
    });

    if (isClashingTimetable) {
        alert(`❌ Booking unavailable! Conflicts with regular class:\nCourse: ${isClashingTimetable.Course_ID} ${isClashingTimetable.Course}\nLecturer: ${isClashingTimetable.Lecturer}`);
        return; 
    }

    const isClashingBooking = allBookings.find(b => {
        const parsed = parseStatus(b.Status);
        if (b.Room !== reqRoom || b.Date !== reqDate || parsed.status !== "Approved") return false;
        const [bStart, bEnd] = b.TimeRange.split(" - ");
        return (reqStart < bEnd.trim()) && (reqEnd > bStart.trim());
    });

    if (isClashingBooking) {
        alert(`❌ Booking unavailable! Time slot is already reserved by:\n${isClashingBooking.Name}`);
        return; 
    }

    const submitBtn = document.getElementById('admin-submit-btn');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerHTML = `<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Processing...</div>`;
    submitBtn.disabled = true;

    const formData = {
        action: "quickBook",
        adminId: currentUser.id,
        name: document.getElementById('admin-name').value + " (Admin)",
        studentId: document.getElementById('admin-staffId').value,
        room: reqRoom,
        date: reqDate,
        timeRange: `${reqStart} - ${reqEnd}`,
        reason: document.getElementById('admin-reason').value,
        status: "อนุมัติแล้ว"
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (result.status === "success") {
            alert("✅ Admin Quick Booking Successful! The room has been auto-approved.");
            document.getElementById('admin-reason').value = "";
            document.getElementById('admin-startTime').value = "";
            document.getElementById('admin-endTime').value = "";
            switchAdminTab('room-status'); 
            await loadAdminSchedule(false);
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Connection failed: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

// ==========================================
// EMAIL PREVIEW
// เปิดดูตัวอย่างเท่านั้น ไม่ส่งอีเมล
// ==========================================
window.openEmailPreview = async function(bookingId) {
    const modal = document.getElementById('email-preview-modal');
    const loadingBox = document.getElementById('email-preview-loading');
    const errorBox = document.getElementById('email-preview-error');
    const contentBox = document.getElementById('email-preview-content');

    const toElement = document.getElementById('email-preview-to');
    const subjectElement = document.getElementById('email-preview-subject');
    const bodyElement = document.getElementById('email-preview-body');

    if (
        !modal ||
        !loadingBox ||
        !errorBox ||
        !contentBox ||
        !toElement ||
        !subjectElement ||
        !bodyElement
    ) {
        alert("ไม่พบโครงสร้าง Email Preview Modal ใน admin.html");
        return;
    }

    // เปิด Popup และเริ่มสถานะ Loading
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    loadingBox.classList.remove('hidden');
    errorBox.classList.add('hidden');
    contentBox.classList.add('hidden');

    errorBox.textContent = '';
    toElement.textContent = '';
    subjectElement.textContent = '';
    bodyElement.textContent = '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "previewStatusEmail",
                id: bookingId,
                adminId: currentUser.id
            })
        });

        const result = await response.json();

        if (
            result.status !== "success" ||
            !result.preview
        ) {
            throw new Error(
                result.message ||
                "ระบบไม่สามารถสร้างตัวอย่างอีเมลได้"
            );
        }

        // ใช้ textContent เพื่อไม่ให้ข้อมูลถูกแปลงเป็น HTML
        toElement.textContent =
            result.preview.to || "-";

        subjectElement.textContent =
            result.preview.subject || "-";

        bodyElement.textContent =
            result.preview.body || "-";

        contentBox.classList.remove('hidden');

    } catch (error) {
        errorBox.textContent =
            "ไม่สามารถแสดงตัวอย่างอีเมล: " + error.message;

        errorBox.classList.remove('hidden');

    } finally {
        loadingBox.classList.add('hidden');
    }
};


window.closeEmailPreview = function() {
    const modal = document.getElementById('email-preview-modal');

    if (modal) {
        modal.classList.add('hidden');
    }

    document.body.style.overflow = '';
};


// กด Escape เพื่อปิด Popup ที่กำลังเปิดอยู่
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;

    const declineModal = document.getElementById('decline-modal');
    const emailModal = document.getElementById('email-preview-modal');

    if (declineModal && !declineModal.classList.contains('hidden')) {
        closeDeclineModal();
        return;
    }

    if (emailModal && !emailModal.classList.contains('hidden')) {
        closeEmailPreview();
    }
});

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}




// ==========================================
// 🔑 ระบบเปลี่ยนรหัสผ่าน ฉบับป้องกันความผิดพลาด 100% (Bulletproof Change Password)
// ==========================================
window.openPasswordModal = function() {
    const modal = document.getElementById('password-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        alert("❌ ไม่สามารถเปิดหน้าต่างได้: หา Element id='password-modal' ไม่พบในหน้า HTML ครับ");
    }
}

window.closePasswordModal = function() {
    const modal = document.getElementById('password-modal');
    const form = document.getElementById('change-password-form');
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
}

// ฟังก์ชันหลักสำหรับดักจับและส่งข้อมูลเปลี่ยนรหัสผ่าน
window.handleChangePasswordSubmit = async function(e) {
    if (e) e.preventDefault(); // บังคับหยุดการรีเฟรชหน้าจอของเบราว์เซอร์
    
    // ครอบ try...catch ตั้งแต่บรรทัดแรกสุดเพื่อดักจับทุกความผิดพลาดของโครงสร้าง HTML/JS
    try {
        const oldInput = document.getElementById('old-password');
        const newInput = document.getElementById('new-password');
        const confirmInput = document.getElementById('confirm-password');
        const submitBtn = document.getElementById('change-pw-submit-btn');

        // 🔍 ส่วนตรวจสอบความถูกต้องของโครงสร้าง HTML (ถ้าหาไม่เจอจะแจ้งเตือนทันที ไม่นิ่งเงียบ)
        if (!oldInput) throw new Error("หาช่องกรอกรหัสผ่านเดิมไม่เจอ (id='old-password' อาจไม่มีใน HTML)");
        if (!newInput) throw new Error("หาช่องกรอกรหัสผ่านใหม่ไม่เจอ (id='new-password' อาจไม่มีใน HTML)");
        if (!confirmInput) throw new Error("หาช่องยืนยันรหัสผ่านใหม่ไม่เจอ (id='confirm-password' อาจไม่มีใน HTML)");
        if (!submitBtn) throw new Error("หาปุ่มกดอัปเดตรหัสผ่านไม่เจอ (id='change-pw-submit-btn' อาจไม่มีใน HTML)");
        if (!currentUser || !currentUser.id) throw new Error("ไม่พบข้อมูล Session ผู้ใช้งานปัจจุบัน กรุณาลองออกจากระบบและล็อกอินใหม่อีกครั้ง");

        const oldPw = oldInput.value;
        const newPw = newInput.value;
        const confirmPw = confirmInput.value;

        if (!oldPw || !newPw || !confirmPw) {
            alert("❌ กรุณากรอกข้อมูลให้ครบทุกช่องครับ");
            return;
        }

        if (newPw !== confirmPw) {
            alert("❌ รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกันครับ กรุณาตรวจสอบอีกครั้ง");
            return;
        }

        // แสดงสถานะการโหลดที่ปุ่มกด
        const originalText = submitBtn.innerText || "Update Password";
        submitBtn.innerHTML = `<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Updating...</div>`;
        submitBtn.disabled = true;

        // ส่งข้อมูลไปยัง Google Apps Script Web App
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "changePassword",
                id: currentUser.id, 
                oldPassword: oldPw,
                newPassword: newPw
            })
        });
        
        const result = await response.json();
        
        // ตรวจสอบข้อมูลขากลับจากลอจิกสคริปต์หลังบ้าน
        // ตรวจสอบข้อมูลขากลับจากลอจิกสคริปต์หลังบ้าน
        if (result.message === "Password updated successfully") {
            alert(`✅ เปลี่ยนรหัสผ่านสำหรับคุณ ${currentUser.name} เรียบร้อยแล้วครับ`);
            logout(); 
        } 
        else if (result.id) {
            // ปรับเป็นข้อความแจ้งเตือนแบบเป็นทางการ ไม่บอกข้อมูลเชิงเทคนิค
            alert("❌ ระบบขัดข้องชั่วคราว: ไม่สามารถอัปเดตรหัสผ่านได้ในขณะนี้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบครับ");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        } 
        else {
            alert("❌ ไม่สามารถดำเนินการได้เนื่องจาก: " + result.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }

    } catch (error) {
        // หากมีปัญหาใดๆ ฟ้องข้อความออกมาทางหน้าจอตรงๆ ทันที
        alert("❌ JavaScript Error: " + error.message);
        const submitBtn = document.getElementById('change-pw-submit-btn');
        if (submitBtn) {
            submitBtn.innerText = "Update Password";
            submitBtn.disabled = false;
        }
    }
};

// สั่งให้สคริปต์ผูกกับฟอร์มเมื่อหน้าเว็บโหลดเสร็จสิ้น
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', window.handleChangePasswordSubmit);
}