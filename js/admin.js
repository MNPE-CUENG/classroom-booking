const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    alert("Unauthorized Access. เฉพาะผู้ดูแลระบบเท่านั้น");
    window.location.href = 'login.html';
}

let roomList = [];
const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];
// เพิ่มตัวแปร daysOfWeek สำหรับเช็กวันในตารางเรียนหลัก
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

window.onload = function() {
    document.getElementById('admin-display').innerText = `ADMIN: ${currentUser.name}`;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('admin-view-date').value = today;
    loadAdminSchedule();
};

function switchAdminTab(tabName) {
    const tabManagement = document.getElementById('tab-management');
    const tabRoomStatus = document.getElementById('tab-room-status');
    const contentManagement = document.getElementById('content-management');
    const contentRoomStatus = document.getElementById('content-room-status');

    if (tabName === 'management') {
        tabManagement.className = "py-2.5 px-6 font-semibold text-sm border-b-2 border-red-800 text-red-800 focus:outline-none uppercase tracking-wider";
        tabRoomStatus.className = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none uppercase tracking-wider";
        contentManagement.classList.remove('hidden');
        contentRoomStatus.classList.add('hidden');
    } else {
        tabRoomStatus.className = "py-2.5 px-6 font-semibold text-sm border-b-2 border-red-800 text-red-800 focus:outline-none uppercase tracking-wider";
        tabManagement.className = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none uppercase tracking-wider";
        contentRoomStatus.classList.remove('hidden');
        contentManagement.classList.add('hidden');
    }
}

async function loadAdminSchedule() {
    const tableContainer = document.getElementById('admin-table-container');
    const gridContainer = document.getElementById('admin-timetable-container');
    const selectedDate = document.getElementById('admin-view-date').value;

    tableContainer.innerHTML = '<p class="text-gray-500 text-sm animate-pulse">กำลังโหลดข้อมูล...</p>';
    gridContainer.innerHTML = '<p class="p-6 text-gray-500 text-sm animate-pulse italic text-center">กำลังโหลดตารางห้องว่าง...</p>';

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            const bookings = result.data || [];
            const timetables = result.timetable || []; // ดึงข้อมูลตารางสอนหลัก
            const fetchedRooms = result.rooms || [];
            
            roomList = fetchedRooms.map(r => r.RoomName).filter(Boolean);

            // ==========================================
            // แท็บ 1: จัดการคำขอ (Bookings)
            // ==========================================
            const sortedBookings = [...bookings].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            if (sortedBookings.length === 0) {
                tableContainer.innerHTML = '<p class="text-gray-500 text-sm">ยังไม่มีคำขอจองในระบบ</p>';
            } else {
                let tableHTML = `<table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-100"><tr><th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">ID</th><th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Lecturer</th><th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Room & Date</th><th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Purpose</th><th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Status</th><th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

                sortedBookings.forEach(booking => {
                    let statusColor = "bg-yellow-100 text-yellow-800 border-yellow-200"; 
                    if (booking.Status === "อนุมัติแล้ว" || booking.Status === "Approved") statusColor = "bg-green-100 text-green-800 border-green-200";
                    if (booking.Status === "ไม่อนุมัติ" || booking.Status === "Rejected") statusColor = "bg-red-100 text-red-800 border-red-200";

                    tableHTML += `<tr class="hover:bg-gray-50 transition-colors"><td class="px-4 py-3 text-xs text-gray-500 font-mono">${booking.ID}</td><td class="px-4 py-3 text-sm font-medium text-gray-800">${booking.Name}<br><span class="text-xs text-gray-500 font-normal">ID: ${booking.StudentID}</span></td><td class="px-4 py-3 text-sm text-gray-800"><span class="font-semibold text-blue-800">${booking.Room}</span><br><span class="text-xs text-gray-600">${booking.Date} | <span class="font-mono text-red-800 font-medium">${booking.TimeRange}</span></span></td><td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title="${booking.Reason}">${booking.Reason}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusColor}">${booking.Status}</span></td><td class="px-4 py-3 text-center space-x-2 whitespace-nowrap"><button onclick="updateStatus('${booking.ID}', 'อนุมัติแล้ว')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition shadow-sm">Approve</button><button onclick="updateStatus('${booking.ID}', 'ไม่อนุมัติ')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition shadow-sm">Reject</button></td></tr>`;
                });
                tableHTML += `</tbody></table>`;
                tableContainer.innerHTML = tableHTML;
            }

            // ==========================================
            // แท็บ 2: ตารางห้องว่างแบบ 2 เลเยอร์ (อัปเดต Timezone แล้ว)
            // ==========================================
            // ✅ นี่คือจุดที่แก้ Timezone Offset ครับ เติม 'T00:00:00' เพื่อบังคับเวลาเที่ยงคืนตรง
            const currentDayName = daysOfWeek[new Date(selectedDate + 'T00:00:00').getDay()]; 

            let gridHTML = `<table class="min-w-full divide-y divide-gray-200 text-xs text-center grid-table bg-white"><thead class="bg-gray-100 text-gray-700 font-bold"><tr><th class="px-4 py-3 text-left border">Room / Time</th>`;
            timeSlots.forEach(slot => gridHTML += `<th class="px-2 py-3 border font-mono">${slot}</th>`);
            gridHTML += `</tr></thead><tbody class="divide-y divide-gray-200">`;

            roomList.forEach(room => {
                gridHTML += `<tr><td class="px-4 py-3 font-semibold text-gray-800 border text-left bg-gray-50">${room}</td>`;
                timeSlots.forEach(slot => {
                    
                    // เช็กเลเยอร์ 1 (ตารางเรียนประจำเทอม)
                    const isRegularClass = timetables.find(t => {
                        if (t.Room !== room || t.DayOfWeek.trim().toLowerCase() !== currentDayName.toLowerCase()) return false;
                        const [start, end] = t.TimeRange.split(" - ");
                        return slot >= start.trim() && slot < end.trim();
                    });

                    // เช็กเลเยอร์ 2 (ตารางจองรายครั้ง)
                    const isBooked = bookings.find(b => {
                        if (b.Room !== room || b.Date !== selectedDate) return false;
                        if (b.Status !== "อนุมัติแล้ว" && b.Status !== "Approved") return false;
                        const [start, end] = b.TimeRange.split(" - ");
                        return slot >= start.trim() && slot < end.trim();
                    });

                    if (isRegularClass) {
                        // เลเยอร์ 1: แสดงวิชาหลัก (รหัสวิชา, ชื่อวิชา, ชื่ออาจารย์)
                        gridHTML += `<td class="p-1.5 border bg-orange-100 text-orange-900 leading-tight align-top min-w-[110px]">
                            <div class="font-bold text-[11px]">${isRegularClass.Course_ID}</div>
                            <div class="text-[10px] font-medium mt-0.5 whitespace-normal break-words">${isRegularClass.Course}</div>
                            <div class="text-[10px] text-orange-700 mt-0.5">${isRegularClass.Lecturer}</div>
                        </td>`;
                    } else if (isBooked) {
                        // เลเยอร์ 2: แสดงการจองรายครั้ง (ชื่อผู้จอง)
                        gridHTML += `<td class="p-1.5 border bg-blue-100 text-blue-900 leading-tight align-top min-w-[110px]">
                            <div class="font-bold text-[11px] whitespace-normal break-words">${isBooked.Name}</div>
                            <div class="text-[9px] text-blue-600 mt-0.5 whitespace-normal break-words">(${isBooked.Reason})</div>
                        </td>`;
                    } else {
                        // ช่องว่าง: ปล่อยให้เป็นช่องเปล่าๆ ไม่มีข้อความ
                        gridHTML += `<td class="p-1 border"></td>`;
                    }
                });
                gridHTML += `</tr>`;
            });
            gridHTML += `</tbody></table>`;
            gridContainer.innerHTML = gridHTML;

        } else {
            tableContainer.innerHTML = `<p class="text-red-500 text-sm">Error: ${result.message}</p>`;
        }
    } catch (error) {
        tableContainer.innerHTML = `<p class="text-red-500 text-sm">Connection failed: ${error.message}</p>`;
    }
}

async function updateStatus(bookingId, newStatus) {
    if (!confirm(`คุณต้องการเปลี่ยนสถานะเป็น "${newStatus}" ใช่หรือไม่?`)) return;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateStatus", id: bookingId, status: newStatus })
        });
        const result = await response.json();
        if (result.status === "success") loadAdminSchedule();
        else alert("เกิดข้อผิดพลาด: " + result.message);
    } catch (error) { alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์: " + error.message); }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}