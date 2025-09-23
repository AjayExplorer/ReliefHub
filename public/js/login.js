document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
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

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Login successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
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
                    default:
                        window.location.href = '/';
                }
            }, 1000);
        } else {
            showAlert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
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