let roomList = [];

// ตรวจสอบสถานะการล็อกอินว่าเป็น Admin หรือไม่
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    alert("Unauthorized Access. เฉพาะผู้ดูแลระบบเท่านั้น");
    window.location.href = 'login.html';
}


const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

// เตรียมหน้าเว็บเมื่อโหลดเสร็จ
window.onload = function() {
    document.getElementById('admin-display').innerText = `ADMIN: ${currentUser.name}`;
    
    // ตั้งค่าวันที่เริ่มต้นสำหรับดูตารางห้องเป็น "วันนี้"
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('admin-view-date').value = today;
    
    loadAdminSchedule();
};

// ฟังก์ชันสลับแท็บ
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

// โหลดและวาดข้อมูลทั้ง 2 แท็บ
async function loadAdminSchedule() {
    const tableContainer = document.getElementById('admin-table-container');
    const gridContainer = document.getElementById('admin-timetable-container');
    const selectedDate = document.getElementById('admin-view-date').value;

    tableContainer.innerHTML = '<p class="text-gray-500 text-sm animate-pulse">กำลังโหลดข้อมูลคำขอจอง...</p>';
    gridContainer.innerHTML = '<p class="p-6 text-gray-500 text-sm animate-pulse italic text-center">กำลังโหลดตารางห้องว่าง...</p>';

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            const bookings = result.data;
            const fetchedRooms = result.rooms || [];
            
            // อัปเดตรายชื่อห้องสำหรับวาดตาราง Grid
            roomList = fetchedRooms.map(r => r.RoomName);

            // ==========================================
            // แท็บ 1: วาดตารางจัดการคำขอ... (โค้ดเดิม)

            // ==========================================
            // แท็บ 1: วาดตารางจัดการคำขอ (เรียงจากคำขอใหม่ล่าสุด)
            // ==========================================
            const sortedBookings = [...bookings].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            if (sortedBookings.length === 0) {
                tableContainer.innerHTML = '<p class="text-gray-500 text-sm">ยังไม่มีคำขอจองในระบบ</p>';
            } else {
                let tableHTML = `
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">ID</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Lecturer</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Room & Date</th>
                                <th class="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Purpose</th>
                                <th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Status</th>
                                <th class="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                `;

                sortedBookings.forEach(booking => {
                    let statusColor = "bg-yellow-100 text-yellow-800 border-yellow-200"; 
                    if (booking.Status === "อนุมัติแล้ว" || booking.Status === "Approved") statusColor = "bg-green-100 text-green-800 border-green-200";
                    if (booking.Status === "ไม่อนุมัติ" || booking.Status === "Rejected") statusColor = "bg-red-100 text-red-800 border-red-200";

                    tableHTML += `
                        <tr class="hover:bg-gray-50 transition-colors">
                            <td class="px-4 py-3 text-xs text-gray-500 font-mono">${booking.ID}</td>
                            <td class="px-4 py-3 text-sm font-medium text-gray-800">
                                ${booking.Name}<br>
                                <span class="text-xs text-gray-500 font-normal">ID: ${booking.StudentID}</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-800">
                                <span class="font-semibold text-blue-800">${booking.Room}</span><br>
                                <span class="text-xs text-gray-600">${booking.Date} | <span class="font-mono text-red-800 font-medium">${booking.TimeRange}</span></span>
                            </td>
                            <td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title="${booking.Reason}">${booking.Reason}</td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusColor}">${booking.Status}</span>
                            </td>
                            <td class="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                                <button onclick="updateStatus('${booking.ID}', 'อนุมัติแล้ว')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition shadow-sm">Approve</button>
                                <button onclick="updateStatus('${booking.ID}', 'ไม่อนุมัติ')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition shadow-sm">Reject</button>
                            </td>
                        </tr>
                    `;
                });
                tableHTML += `</tbody></table>`;
                tableContainer.innerHTML = tableHTML;
                tableContainer.classList.remove('flex', 'items-center', 'justify-center');
            }

            // ==========================================
            // แท็บ 2: วาดตาราง Grid ห้องว่าง (Room Status)
            // ==========================================
            let gridHTML = `
                <table class="min-w-full divide-y divide-gray-200 text-xs text-center grid-table bg-white">
                    <thead class="bg-gray-100 text-gray-700 font-bold">
                        <tr><th class="px-4 py-3 text-left border">Room / Time</th>
            `;
            timeSlots.forEach(slot => gridHTML += `<th class="px-2 py-3 border font-mono">${slot}</th>`);
            gridHTML += `</tr></thead><tbody class="divide-y divide-gray-200">`;

            roomList.forEach(room => {
                gridHTML += `<tr><td class="px-4 py-3 font-semibold text-gray-800 border text-left bg-gray-50">${room}</td>`;
                
                timeSlots.forEach(slot => {
                    const match = bookings.find(b => {
                        if (b.Room !== room || b.Date !== selectedDate) return false;
                        if (b.Status !== "อนุมัติแล้ว" && b.Status !== "Approved") return false;
                        const [start, end] = b.TimeRange.split(" - ");
                        return slot >= start && slot < end;
                    });

                    if (match) {
                        gridHTML += `<td class="p-1 border bg-blue-100 text-blue-800 font-medium truncate max-w-[100px]" title="Booked by ${match.Name}">${match.Name}</td>`;
                    } else {
                        gridHTML += `<td class="p-1 border text-gray-300 font-light font-mono">Vacant</td>`;
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

// อัปเดตสถานะกลับไปยัง Sheets
async function updateStatus(bookingId, newStatus) {
    if (!confirm(`คุณต้องการเปลี่ยนสถานะเป็น "${newStatus}" ใช่หรือไม่?`)) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateStatus", id: bookingId, status: newStatus })
        });
        const result = await response.json();
        if (result.status === "success") {
            loadAdminSchedule(); // โหลดข้อมูลใหม่ทั้งหมด
        } else {
            alert("เกิดข้อผิดพลาด: " + result.message);
        }
    } catch (error) {
        alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์: " + error.message);
    }
}

// ฟังก์ชัน Log out
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}