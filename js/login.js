// API_URL ถูกประกาศในไฟล์ config.js

// เคลียร์ข้อมูลผู้ใช้เดิมเมื่อกลับเข้าสู่หน้า Login
localStorage.removeItem('currentUser');

const loginForm = document.getElementById('login-form');
const staffIdField = document.getElementById('staffId');
const passwordField = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');
const loginBtn = document.getElementById('login-btn');
const loginBtnContent = document.getElementById('login-btn-content');
const togglePasswordBtn = document.getElementById('toggle-password');
const eyeOpenIcon = document.getElementById('eye-open-icon');
const eyeClosedIcon = document.getElementById('eye-closed-icon');

function setLoginLoading(isLoading) {
    loginBtn.disabled = isLoading;

    if (isLoading) {
        loginBtnContent.innerHTML = `
            <span class="button-spinner" aria-hidden="true"></span>
            <span>Verifying...</span>
        `;
        loginBtn.setAttribute('aria-busy', 'true');
    } else {
        loginBtnContent.textContent = 'Sign in';
        loginBtn.removeAttribute('aria-busy');
    }
}

function showLoginError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
}

function hideLoginError() {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
}

if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', function() {
        const isPasswordVisible = passwordField.type === 'text';

        passwordField.type = isPasswordVisible ? 'password' : 'text';
        togglePasswordBtn.setAttribute(
            'aria-pressed',
            String(!isPasswordVisible)
        );
        togglePasswordBtn.setAttribute(
            'aria-label',
            isPasswordVisible ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน'
        );

        eyeOpenIcon.classList.toggle('hidden', !isPasswordVisible);
        eyeClosedIcon.classList.toggle('hidden', isPasswordVisible);

        passwordField.focus();
    });
}

staffIdField.addEventListener('input', hideLoginError);
passwordField.addEventListener('input', hideLoginError);

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    hideLoginError();

    const staffIdInput = staffIdField.value.trim();
    const passwordInput = passwordField.value.trim();

    if (!staffIdInput || !passwordInput) {
        showLoginError('Please enter your email and password.');
        (!staffIdInput ? staffIdField : passwordField).focus();
        return;
    }

    setLoginLoading(true);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'login',
                id: staffIdInput,
                password: passwordInput
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'success' && result.user) {
            localStorage.setItem(
                'currentUser',
                JSON.stringify(result.user)
            );

            window.location.href =
                result.user.role === 'admin'
                    ? 'admin.html'
                    : 'index.html';

            return;
        }

        let errorMsg = result.message;
        if (errorMsg === "ID หรือ Password ไม่ถูกต้อง") {
            errorMsg = "Invalid email or password.";
        }
        showLoginError(errorMsg || 'Invalid email or password.');
        );
        passwordField.select();

    } catch (error) {
        console.error('Login error:', error);
        showLoginError(
            'Connection failed. Please check your internet connection and try again.'
        );

    } finally {
        setLoginLoading(false);
    }
});
