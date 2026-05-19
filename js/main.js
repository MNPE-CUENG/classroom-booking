// 1. ตรวจสอบสถานะการล็อกอิน
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'lecturer') {
    alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
    window.location.href = 'login.html';
}

let roomList = [];
let roomImages = {};
let globalBookings = [];  // เก็บข้อมูลการจองรายครั้ง
let globalTimetable = []; // เก็บข้อมูลตารางสอนประจำเทอม

const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

window.onload = function() {
    document.getElementById('name').value = currentUser.name;
    document.getElementById('staffId').value = currentUser.id;
    document.getElementById('user-display').innerText = `Lecturer: ${currentUser.name} (${currentUser.id})`;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('view-date').value = today;
    document.getElementById('date').value = today;

    loadSchedule();
};

function switchTab(tabName) {
    const tabTimetable = document.getElementById('tab-timetable');
    const tabMyBooking = document.getElementById('tab-my-booking');
    const contentTimetable = document.getElementById('content-timetable');
    const contentMyBooking = document.getElementById('content-my-booking');

    if (tabName === 'timetable') {
        tabTimetable.className = "py-2.5 px-6 font-semibold text-sm border-b-2 border-blue-800 text-blue-800 focus:outline-none uppercase tracking-wider";
        tabMyBooking.className = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none uppercase tracking-wider";
        contentTimetable.classList.remove('hidden');
        contentMyBooking.classList.add('hidden');
    } else {
        tabMyBooking.className = "py-2.5 px-6 font-semibold text-sm border-b-2 border-blue-800 text-blue-800 focus:outline-none uppercase tracking-wider";
        tabTimetable.className = "py-2.5 px-6 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none uppercase tracking-wider";
        contentTimetable.classList.add('hidden');
        contentMyBooking.classList.remove('hidden');
    }
}

async function loadSchedule() {
    const timetableContainer = document.getElementById('timetable-container');
    const myReservationsContainer = document.getElementById('my-reservations-container');
    const selectedDate = document.getElementById('view-date').value;

    timetableContainer.innerHTML = '<p class="p-6 text-gray-500 text-sm animate-pulse italic text-center">⏳ Loading schedule grid...</p>';
    myReservationsContainer.innerHTML = '<p class="p-6 text-gray-500 text-sm animate-pulse italic text-center">⏳ Loading your reservations...</p>';

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            globalBookings = result.data || [];
            globalTimetable = result.timetable || [];
            const fetchedRooms = result.rooms || [];

            // อัปเดตตัวเลือกห้อง
            roomList = [];
            roomImages = {};
            const roomSelect = document.getElementById('room');
            roomSelect.innerHTML = '<option value="">-- Select Room --</option>'; 

            fetchedRooms.forEach(r => {
                if (r.RoomName) {
                    roomList.push(r.RoomName);
                    roomImages[r.RoomName] = r.ImageURL;
                    roomSelect.innerHTML += `<option value="${r.RoomName}">${r.RoomName}</option>`;
                }
            });

            // คำนวณวันในสัปดาห์ เช่น "Monday"
            const currentDayName = daysOfWeek[new Date(selectedDate + 'T00:00:00').getDay()];

            // ==========================================
            // วาดตาราง Grid (ซ้อนทับ 2 เลเยอร์)
            // ==========================================
            let gridHTML = `
                <table class="min-w-full divide-y divide-gray-200 text-xs text-center grid-table bg-white">
                    <thead class="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                            <th class="px-4 py-3 text-left border">Room / Time</th>
            `;
            
            timeSlots.forEach(slot => { gridHTML += `<th class="px-2 py-3 border font-mono">${slot}</th>`; });
            gridHTML += `</tr></thead><tbody class="divide-y divide-gray-200">`;

            roomList.forEach(room => {
                gridHTML += `<tr><td class="px-4 py-3 font-semibold text-gray-800 border text-left bg-gray-50">${room}</td>`;
                
                timeSlots.forEach(slot => {
                    // เลเยอร์ 1: ตรวจสอบตารางสอนประจำเทอม (Timetable)
                    const isRegularClass = globalTimetable.find(t => {
                        if (t.Room !== room || t.DayOfWeek.trim().toLowerCase() !== currentDayName.toLowerCase()) return false;
                        const [start, end] = t.TimeRange.split(" - ");
                        return slot >= start.trim() && slot < end.trim();
                    });

                    // เลเยอร์ 2: ตรวจสอบการจองรายครั้ง (Bookings)
                    const isBooked = globalBookings.find(b => {
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
            timetableContainer.innerHTML = gridHTML;

            // ==========================================
            // วาดตาราง My Reservations
            // ==========================================
            const myBookings = globalBookings.filter(b => b.StudentID === currentUser.id);
            if (myBookings.length === 0) {
                myReservationsContainer.innerHTML = '<p class="p-6 text-gray-500 text-sm text-center">No reservations submitted by you yet.</p>';
                return;
            }

            let myListHTML = `<table class="min-w-full divide-y divide-gray-200 border"><thead class="bg-gray-50 text-gray-600 text-xs font-bold uppercase"><tr><th class="px-4 py-3 text-left">Room</th><th class="px-4 py-3 text-left">Date & Time</th><th class="px-4 py-3 text-left">Purpose</th><th class="px-4 py-3 text-center">Status</th></tr></thead><tbody class="bg-white divide-y divide-gray-200 text-sm">`;
            
            myBookings.forEach(b => {
                let statusColor = "bg-yellow-100 text-yellow-800 border-yellow-200"; 
                if (b.Status === "อนุมัติแล้ว" || b.Status === "Approved") statusColor = "bg-green-100 text-green-800 border-green-200";
                if (b.Status === "ไม่อนุมัติ" || b.Status === "Rejected") statusColor = "bg-red-100 text-red-800 border-red-200";

                myListHTML += `<tr><td class="px-4 py-3 font-semibold text-blue-900">${b.Room}</td><td class="px-4 py-3 text-xs text-gray-700">${b.Date}<br><span class="font-mono font-medium">${b.TimeRange}</span></td><td class="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title="${b.Reason}">${b.Reason}</td><td class="px-4 py-3 text-center"><span class="px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full border ${statusColor}">${b.Status}</span></td></tr>`;
            });
            myListHTML += `</tbody></table>`;
            myReservationsContainer.innerHTML = myListHTML;

        } else {
            timetableContainer.innerHTML = `<p class="p-4 text-red-500 text-sm text-center">Error loading data: ${result.message}</p>`;
        }
    } catch (error) {
        timetableContainer.innerHTML = `<p class="p-4 text-red-500 text-sm text-center">Connection Error: ${error.message}</p>`;
    }
}

// 2. จัดการส่งฟอร์ม (รวมระบบตรวจจับเวลาชน Clash Detection)
document.getElementById('booking-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reqRoom = document.getElementById('room').value;
    const reqDate = document.getElementById('date').value;
    const reqStart = document.getElementById('startTime').value;
    const reqEnd = document.getElementById('endTime').value;
    const reqDayName = daysOfWeek[new Date(reqDate + 'T00:00:00').getDay()];

    if (reqStart >= reqEnd) {
        alert("ข้อผิดพลาด: เวลาเริ่มต้องน้อยกว่าเวลาจบ");
        return;
    }

    // -- ระบบตรวจจับการชน เลเยอร์ 1: ชนวิชาหลักหรือไม่? --
    const isClashingTimetable = globalTimetable.find(t => {
        if (t.Room !== reqRoom || t.DayOfWeek.trim().toLowerCase() !== reqDayName.toLowerCase()) return false;
        const [tStart, tEnd] = t.TimeRange.split(" - ");
        // ลอจิกเวลาทับซ้อน (Overlap)
        return (reqStart < tEnd.trim()) && (reqEnd > tStart.trim());
    });

    if (isClashingTimetable) {
        alert(`❌ ไม่สามารถจองได้! ช่วงเวลานี้ติดตารางเรียนวิชาหลัก:\nวิชา: ${isClashingTimetable.Course_ID} ${isClashingTimetable.Course}\nอาจารย์: ${isClashingTimetable.Lecturer}`);
        return; // หยุดการทำงาน ไม่ให้ส่งฟอร์ม
    }

    // -- ระบบตรวจจับการชน เลเยอร์ 2: ชนคนที่จองก่อนหน้าหรือไม่? --
    const isClashingBooking = globalBookings.find(b => {
        if (b.Room !== reqRoom || b.Date !== reqDate) return false;
        if (b.Status !== "อนุมัติแล้ว" && b.Status !== "Approved") return false;
        const [bStart, bEnd] = b.TimeRange.split(" - ");
        return (reqStart < bEnd.trim()) && (reqEnd > bStart.trim());
    });

    if (isClashingBooking) {
        alert(`❌ ไม่สามารถจองได้! ช่วงเวลานี้ถูกจองไปแล้วโดย:\n${isClashingBooking.Name}`);
        return; // หยุดการทำงาน
    }

    // หากไม่ชนเลย ให้ดำเนินการส่งข้อมูลเข้าฐานข้อมูล
    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "PROCESSING...";
    submitBtn.disabled = true;

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
            alert("✅ ส่งคำขอจองห้องสำเร็จ! กรุณารอแอดมินอนุมัติ");
            document.getElementById('reason').value = "";
            loadSchedule();
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