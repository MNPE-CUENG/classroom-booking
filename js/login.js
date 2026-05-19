// ลบ const API_URL ออกไปแล้ว เพราะเราเรียกใช้จากไฟล์ config.js แทน

// เคลียร์ข้อมูลเก่าเมื่อเข้าหน้า Login
localStorage.removeItem('currentUser');

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault(); // บรรทัดนี้แหละครับที่ทำหน้าที่ "ห้ามไม่ให้หน้าเว็บรีเฟรช" เมื่อพอกดปุ่ม

    const staffIdInput = document.getElementById('staffId').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-msg');
    const loginBtn = document.getElementById('login-btn');
    const originalBtnText = loginBtn.innerText;

    // เปลี่ยนปุ่มระหว่างโหลด
    loginBtn.innerText = "AUTHENTICATING...";
    loginBtn.disabled = true;
    errorMsg.classList.add('hidden');

    try {
        // ส่ง ID และ Password ไปเช็กที่ Google Sheets
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "login",
                id: staffIdInput,
                password: passwordInput
            })
        });

        const result = await response.json();

        if (result.status === "success") {
            // หากผ่าน ให้เก็บข้อมูลผู้ใช้ไว้ 
            const user = result.user;
            localStorage.setItem('currentUser', JSON.stringify(user));

            // แยกทางไปหน้าต่างๆ ตามสิทธิ์
            if (user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            // รหัสผิด
            errorMsg.innerText = "* " + result.message;
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        errorMsg.innerText = "* เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่";
        errorMsg.classList.remove('hidden');
    } finally {
        // คืนสถานะปุ่ม
        loginBtn.innerText = originalBtnText;
        loginBtn.disabled = false;
    }
});