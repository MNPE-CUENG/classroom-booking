const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'lecturer') {
    alert("Please log in to continue.");
    window.location.href = 'login.html';
}

let roomList = [];
let roomImages = {};
let globalBookings = []; 
let globalTimetable = []; 

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

function getUserIdSafe(bookingRecord) {
    for (let key in bookingRecord) {
        if (key.trim() === 'ID' || key.trim() === 'StudentID') return String(bookingRecord[key]).trim();
    }
    return "";
}

function checkNotifications(myBookings) {
    const savedStr = localStorage.getItem('bookingStatuses');
    const saved = savedStr ? JSON.parse(savedStr) : {};
    let notifications = [];

    myBookings.forEach(b => {
        if (!b.ID_RESERVE) return; 
        const oldStatus = saved[b.ID_RESERVE];
        const currentParsed = parseStatus(b.Status);

        if (oldStatus === undefined) { saved[b.ID_RESERVE] = b.Status; } 
        else if (oldStatus !== b.Status) {
            if (currentParsed.status !== "Pending") notifications.push(b);
            saved[b.ID_RESERVE] = b.Status;
        }
    });

    localStorage.setItem('bookingStatuses', JSON.stringify(saved));
    
    if (notifications.length > 0) {
        const existing = document.getElementById('notif-modal');
        if (existing) existing.remove();

        let html = `
        <div id="notif-modal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 px-4 backdrop-blur-sm transition-all duration-300">
            <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all border border-gray-100">
                <div class="flex items-center justify-center mb-4"><div class="bg-indigo-100 p-4 rounded-full text-3xl shadow-inner animate-bounce">🔔</div></div>
                <h3 class="text-xl font-bold text-center text-gray-800 mb-2 tracking-tight">Booking Update</h3>
                <p class="text-sm text-center text-gray-500 mb-5">Your reservation request has been updated.</p>
                <div class="max-h-60 overflow-y-auto custom-scrollbar space-y-3 mb-6 pr-2">`;
        
        notifications.forEach(n => {
            const parsed = parseStatus(n.Status);
            let color = parsed.status === 'Approved' ? 'text-emerald-600' : 'text-rose-600';
            let bg = parsed.status === 'Approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200';
            let icon = parsed.status === 'Approved' ? '✅ Approved' : '❌ Declined';
            let reasonHtml = parsed.reason ? `<p class="text-[11px] text-rose-600 mt-2 font-medium bg-white p-2 rounded border border-rose-100"><b>Reason:</b> ${parsed.reason}</p>` : '';
            
            html += `<div class="${bg} p-4 rounded-xl border shadow-sm">
                <p class="text-sm font-bold text-gray-800 mb-1">${n.Room} <span class="text-gray-500 text-[10px] font-normal ml-1">(${n.Date})</span></p>
                <p class="text-xs text-gray-700 font-medium">New Status: <b class="${color}">${icon}</b></p>
                ${reasonHtml}
            </div>`;
        });
        html += `</div><button onclick="document.getElementById('notif-modal').remove()" class="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-sm">Acknowledge</button></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
}

function populateTimeDropdowns(startId, endId) {
    const stSelect = document.getElementById(startId);
    const etSelect = document.getElementById(endId);
    if (!stSelect || !etSelect) return;
    
    stSelect.innerHTML = '<option value="">-- Start --</option>';
    etSelect.innerHTML = '<option value="">-- End --</option>';
    
    const endSlots = [...timeSlots, "21:30"];
    
    timeSlots.forEach(t => stSelect.innerHTML += `<option value="${t}">${t}</option>`);
    endSlots.forEach(t => {
        if(t !== "08:00") etSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
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
    `;
    document.head.appendChild(style);

    const containers = ['content-timetable', 'content-my-booking', 'timetable-container', 'my-reservations-container'];
    containers.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('fix-overflow'); });

    document.getElementById('name').value = currentUser.name;
    document.getElementById('staffId').value = currentUser.id;
    document.getElementById('user-display').innerText = `Lecturer: ${currentUser.name}`;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('view-date').value = today;
    
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today; 
    }

    populateTimeDropdowns('startTime', 'endTime');
    loadSchedule();
    setInterval(() => { loadSchedule(true); }, 60000);
};

function switchTab(tabName) {
    const tabTimetable = document.getElementById('tab-timetable');
    const tabMyBooking = document.getElementById('tab-my-booking');
    const contentTimetable = document.getElementById('content-timetable');
    const contentMyBooking = document.getElementById('content-my-booking');

    const activeClass = "py-2.5 px-6 font-bold text-sm border-b-2 border-indigo-600 text-indigo-700 focus:outline-none uppercase tracking-wider whitespace-nowrap transition-colors";
    const inactiveClass = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 focus:outline-none uppercase tracking-wider whitespace-nowrap transition-colors";

    if (tabName === 'timetable') {
        tabTimetable.className = activeClass;
        tabMyBooking.className = inactiveClass;
        contentTimetable.classList.remove('hidden');
        contentMyBooking.classList.add('hidden');
    } else {
        tabMyBooking.className = activeClass;
        tabTimetable.className = inactiveClass;
        contentTimetable.classList.add('hidden');
        contentMyBooking.classList.remove('hidden');
    }
}

async function loadSchedule(isSilent = false) {
    const timetableContainer = document.getElementById('timetable-container');
    const myReservationsContainer = document.getElementById('my-reservations-container');
    const selectedDate = document.getElementById('view-date').value;

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
        timetableContainer.innerHTML = loadingHTML;
        myReservationsContainer.innerHTML = loadingHTML;
    } else {
        const rIcon = document.getElementById('refresh-icon');
        if (rIcon) rIcon.classList.add('animate-spin');
    }

    try {
        // 💡 ถ้าเป็นการ Refresh เงียบๆ (isSilent) ให้ขอแค่ข้อมูล Bookings ก็พอ
        const fetchUrl = isSilent ? `${API_URL}?type=bookings_only` : API_URL;
        const response = await fetch(fetchUrl);
        const result = await response.json();

        if (result.status === "success") {
            globalBookings = result.data || [];
            
            // 💡 อัปเดตรายชื่อห้องและตารางเรียน เฉพาะตอนโหลดครั้งแรกสุดเท่านั้น
            if (!isSilent) {
                globalTimetable = result.timetable || [];
                const fetchedRooms = result.rooms || [];
                roomList = [];
                roomImages = {};
                const roomSelect = document.getElementById('room');
                roomSelect.innerHTML = '<option value="">-- Select a Room --</option>'; 
                fetchedRooms.forEach(r => {
                    if (r.RoomName) {
                        roomList.push(r.RoomName);
                        roomImages[r.RoomName] = r.ImageURL;
                        roomSelect.innerHTML += `<option value="${r.RoomName}">${r.RoomName}</option>`;
                    }
                });
            }
    

            const currentDayName = daysOfWeek[new Date(selectedDate + 'T00:00:00').getDay()];

            let gridHTML = `<div class="scroll-wrapper border border-gray-200 rounded-xl shadow-sm bg-white custom-scrollbar pb-2 pr-6">
                <table class="w-max min-w-full text-left bg-white border-collapse">
                <thead class="bg-gray-50 text-gray-600 font-bold text-[11px] uppercase tracking-wider">
                    <tr><th class="px-5 py-4 border-b border-r border-gray-200 sticky-col min-w-[140px] max-w-[140px] z-30">Room / Time</th>`;
            
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

                    const isRegularClass = globalTimetable.find(t => {
                        if (t.Room !== room || t.DayOfWeek.trim().toLowerCase() !== currentDayName.toLowerCase()) return false;
                        
                        // ✅ เพิ่มลอจิกเช็กภาคการศึกษา ให้หน้าอาจารย์
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

                    const isBooked = globalBookings.find(b => {
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
                        gridHTML += `<td colspan="${span}" class="p-3 border-b border-l border-gray-200 bg-orange-50 align-top min-w-[${span * 100}px]">
                            <div class="font-bold text-[12px] text-orange-900 leading-tight mb-1">${isRegularClass.Course_ID}</div>
                            <div class="text-[10px] text-orange-700 leading-tight font-medium mb-1">${isRegularClass.Lecturer}</div>
                            <div class="text-[10px] text-orange-600 font-medium opacity-80 whitespace-normal line-clamp-2">📌 ${isRegularClass.Course}</div>
                        </td>`;
                        i += (span - 1);
                    } else if (isBooked) {
                        let span = 1;
                        while (i + span < timeSlots.length) {
                            const nextSlot = timeSlots[i + span];
                            const [s, e] = isBooked.TimeRange.split(" - ");
                            if (nextSlot >= s.trim() && nextSlot < e.trim()) span++; else break;
                        }
                        gridHTML += `<td colspan="${span}" class="p-3 border-b border-l border-gray-200 bg-indigo-50 align-top min-w-[${span * 100}px]">
                            <div class="font-bold text-[12px] text-indigo-900 leading-tight mb-1">${isBooked.Name.split(' ')[0]}</div>
                            <div class="text-[10px] text-indigo-700 font-medium leading-tight whitespace-normal line-clamp-2" title="${isBooked.Reason}">📝 ${isBooked.Reason}</div>
                        </td>`;
                        i += (span - 1);
                    } else {
                        gridHTML += `<td class="p-2 border-b border-l border-gray-100 min-w-[100px]"></td>`;
                    }
                }
                gridHTML += `</tr>`;
            });
            gridHTML += `</tbody></table></div>`;
            timetableContainer.innerHTML = gridHTML;

            const safeCurrentId = String(currentUser.id).trim();
            const myBookings = globalBookings.filter(b => getUserIdSafe(b) === safeCurrentId);
            
            checkNotifications(myBookings);

            let headerHTML = `
                <div class="flex justify-between items-center mb-4 mt-2 px-1">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider">My Reservations History</h3>
                    <button onclick="loadSchedule(true)" class="text-xs bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-2">
                        <span id="refresh-icon" class="inline-block transition-transform">↻</span> Refresh Status
                    </button>
                </div>`;

            if (myBookings.length === 0) {
                myReservationsContainer.innerHTML = headerHTML + '<div class="p-10 bg-gray-50 rounded-xl text-center border border-dashed border-gray-300"><p class="text-gray-500 font-medium">No reservations submitted by you yet.</p></div>';
                return;
            }

            let myListHTML = headerHTML + `<div class="scroll-wrapper border border-gray-200 rounded-xl shadow-sm bg-white pb-2">
                <table class="w-full min-w-max divide-y divide-gray-200 text-left text-sm border-collapse">
                    <thead class="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                            <th class="px-5 py-4 border-b border-gray-200 whitespace-nowrap">Room</th>
                            <th class="px-5 py-4 border-b border-gray-200 min-w-[160px]">Date & Time</th>
                            <th class="px-5 py-4 border-b border-gray-200 min-w-[250px] max-w-sm">Purpose / Remarks</th>
                            <th class="px-5 py-4 border-b border-gray-200 text-center whitespace-nowrap">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;
            
            myBookings.forEach(b => {
                const parsed = parseStatus(b.Status);
                let statusBadge = ""; 
                if (parsed.status === "Approved") statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
                else if (parsed.status === "Declined") statusBadge = "bg-rose-100 text-rose-800 border-rose-200";
                else statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
                
                let reasonDisplay = b.Reason;
                if (parsed.reason) {
                    reasonDisplay += `<br><span class="inline-block mt-2 px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded border border-red-100 font-semibold shadow-sm">Declined Reason: ${parsed.reason}</span>`;
                }

                myListHTML += `<tr class="hover:bg-indigo-50/30 transition-colors">
                    <td class="px-5 py-4 align-top font-bold text-indigo-800 whitespace-nowrap">${b.Room}</td>
                    <td class="px-5 py-4 align-top text-xs text-gray-700">
                        <div class="font-medium">${b.Date}</div>
                        <div class="mt-1 font-mono text-gray-500">${b.TimeRange}</div>
                    </td>
                    <td class="px-5 py-4 align-top text-xs text-gray-600 leading-relaxed break-words max-w-sm">${reasonDisplay}</td>
                    <td class="px-5 py-4 align-top text-center">
                        <span class="px-3 py-1.5 inline-flex text-[11px] font-bold rounded-full border ${statusBadge}">${parsed.status}</span>
                    </td>
                </tr>`;
            });
            myListHTML += `</tbody></table></div>`;
            myReservationsContainer.innerHTML = myListHTML;

        } else {
            if (!isSilent) timetableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200 text-center">Error: ${result.message}</p>`;
        }
    } catch (error) {
        if (!isSilent) timetableContainer.innerHTML = `<p class="text-red-500 text-sm font-medium p-4 bg-red-50 rounded-lg border border-red-200 text-center">Connection Error. Please try again.</p>`;
    } finally {
        const rIcon = document.getElementById('refresh-icon');
        if (rIcon) rIcon.classList.remove('animate-spin');
    }
}

document.getElementById('booking-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reqRoom = document.getElementById('room').value;
    const reqDate = document.getElementById('date').value;
    const reqStart = document.getElementById('startTime').value;
    const reqEnd = document.getElementById('endTime').value;
    const reqDayName = daysOfWeek[new Date(reqDate + 'T00:00:00').getDay()];

    if (reqStart >= reqEnd) {
        alert("❌ ข้อผิดพลาด: เวลาเริ่มต้น ต้องมาก่อนเวลาสิ้นสุดเสมอ");
        return;
    }

    const now = new Date();
    const selectedDateTime = new Date(`${reqDate}T${reqStart}:00`);
    if (selectedDateTime < now) {
        alert("❌ ไม่สามารถจองย้อนหลังหรือในเวลาที่ผ่านไปแล้วได้ครับ");
        return;
    }

    const isClashingTimetable = globalTimetable.find(t => {
        if (t.Room !== reqRoom || t.DayOfWeek.trim().toLowerCase() !== reqDayName.toLowerCase()) return false;
        
        // ✅ เพิ่มลอจิกเช็กภาคการศึกษา ให้ฟอร์มอาจารย์
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

    const isClashingBooking = globalBookings.find(b => {
        const parsed = parseStatus(b.Status);
        if (b.Room !== reqRoom || b.Date !== reqDate || parsed.status !== "Approved") return false;
        const [bStart, bEnd] = b.TimeRange.split(" - ");
        return (reqStart < bEnd.trim()) && (reqEnd > bStart.trim());
    });

    if (isClashingBooking) {
        alert(`❌ Booking unavailable! Time slot is already reserved by:\n${isClashingBooking.Name}`);
        return; 
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerHTML = `<div class="flex justify-center items-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Processing...</div>`;
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75');

    const formData = {
        name: document.getElementById('name').value,
        studentId: document.getElementById('staffId').value, 
        room: reqRoom,
        date: reqDate,
        timeRange: `${reqStart} - ${reqEnd}`,
        reason: document.getElementById('reason').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (result.status === "success") {
            document.getElementById('reason').value = "";
            document.getElementById('startTime').value = "";
            document.getElementById('endTime').value = "";
            switchTab('my-booking');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await loadSchedule();
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Connection failed: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75');
    }
});

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

document.getElementById('room').addEventListener('change', function() {
    const selectedRoom = this.value;
    const imageContainer = document.getElementById('room-image-container');
    const roomImage = document.getElementById('room-image');
    
    if (selectedRoom && roomImages[selectedRoom] && roomImages[selectedRoom].trim() !== "") {
        let imageUrl = roomImages[selectedRoom].trim();
        const driveRegex = /drive\.google\.com\/file\/d\/(.*?)\//;
        const match = imageUrl.match(driveRegex);
        if (match && match[1]) {
            imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        roomImage.src = imageUrl; 
        imageContainer.classList.remove('hidden'); 
    } else {
        imageContainer.classList.add('hidden'); 
    }
});


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