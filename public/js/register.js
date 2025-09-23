document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim().toLowerCase(),
        password: document.getElementById('password').value,
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        address: document.getElementById('address').value.trim()
    };
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Registration successful! You can now login.', 'success');
            document.getElementById('registerForm').reset();
            
            // Redirect to login page after 2 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            if (data.errors) {
                const errorMessages = data.errors.map(error => error.msg).join('<br>');
                showAlert(errorMessages);
            } else {
                showAlert(data.error || 'Registration failed');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Network error. Please try again.');
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
            // User is already logged in, redirect to appropriate dashboard
            switch (data.user.role) {
                case 'Collector':
                    window.location.href = '/collector-dashboard';
                    break;
                case 'CampOfficial':
                    window.location.href = '/official-dashboard';
                    break;
                case 'Donor':
                    window.location.href = '/donor-dashboard';
                    break;
            }
        }
    } catch (error) {
        console.error('Auth status check error:', error);
    }
}