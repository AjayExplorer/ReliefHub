let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeDashboard();
    setupSidebarNavigation();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated || data.user.role !== 'Collector') {
            window.location.href = '/login';
            return;
        }
        
        currentUser = data.user;
        document.getElementById('userInfo').textContent = `${data.user.username} (${data.user.role})`;
    } catch (error) {
        console.error('Authentication check error:', error);
        window.location.href = '/login';
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function setupSidebarNavigation() {
    const sidebarButtons = document.querySelectorAll('.list-group-item[data-section]');
    
    sidebarButtons.forEach(button => {
        button.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            switchSection(section);
            
            // Update active state
            sidebarButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function switchSection(section) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(el => {
        el.classList.add('d-none');
    });
    
    // Show selected section
    document.getElementById(section).classList.remove('d-none');
    
    // Load section-specific data
    switch (section) {
        case 'overview':
            loadOverviewData();
            break;
        case 'camps':
            loadCampsData();
            break;
        case 'requests':
            loadRequestsData();
            break;
        case 'donations':
            loadDonationsData();
            break;
        case 'inventory':
            loadInventoryAlerts();
            break;
    }
}

function initializeDashboard() {
    loadOverviewData();
}

async function loadOverviewData() {
    try {
        // Load statistics
        const [campsResponse, requestsResponse, donationsResponse, inventoryResponse] = await Promise.all([
            fetch('/api/camps'),
            fetch('/api/requests'),
            fetch('/api/donations'),
            fetch('/api/inventory/alerts/low-stock')
        ]);
        
        const camps = await campsResponse.json();
        const requests = await requestsResponse.json();
        const donations = await donationsResponse.json();
        const lowStockItems = await inventoryResponse.json();
        
        // Update statistics
        document.getElementById('totalCamps').textContent = camps.length;
        document.getElementById('totalRequests').textContent = requests.filter(r => r.status === 'Pending').length;
        document.getElementById('totalDonations').textContent = donations.filter(d => d.status !== 'Delivered').length;
        document.getElementById('lowStockItems').textContent = lowStockItems.length;
        
        // Display recent requests
        const recentRequests = requests.slice(0, 5);
        const requestsHtml = recentRequests.length > 0 ? recentRequests.map(request => `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${request.title}</strong>
                    <span class="badge bg-${getStatusColor(request.status)}">${request.status}</span>
                </div>
                <small class="text-muted">${request.campId.campName} - ${request.urgency} priority</small>
            </div>
        `).join('') : '<p class="text-muted">No recent requests</p>';
        
        document.getElementById('recentRequests').innerHTML = requestsHtml;
        
        // Display recent donations
        const recentDonations = donations.slice(0, 5);
        const donationsHtml = recentDonations.length > 0 ? recentDonations.map(donation => `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${donation.trackingId}</strong>
                    <span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span>
                </div>
                <small class="text-muted">${donation.campId.campName} - ${donation.donationType}</small>
            </div>
        `).join('') : '<p class="text-muted">No recent donations</p>';
        
        document.getElementById('recentDonations').innerHTML = donationsHtml;
        
    } catch (error) {
        console.error('Error loading overview data:', error);
        showAlert('Error loading dashboard data', 'danger');
    }
}

async function loadCampsData() {
    try {
        const response = await fetch('/api/camps');
        const camps = await response.json();
        
        const tableBody = document.getElementById('campsTableBody');
        
        if (camps.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No camps found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = camps.map(camp => `
            <tr>
                <td>${camp.campName}</td>
                <td>${camp.location}</td>
                <td>${camp.strength}</td>
                <td>${camp.assignedOfficials.length}</td>
                <td><span class="badge bg-${camp.status === 'Active' ? 'success' : 'secondary'}">${camp.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="registerOfficialForCamp('${camp._id}', '${camp.campName}')">
                        <i class="fas fa-user-plus"></i> Add Official
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading camps:', error);
        showAlert('Error loading camps data', 'danger');
    }
}

async function loadRequestsData() {
    try {
        const response = await fetch('/api/requests');
        const requests = await response.json();
        
        const tableBody = document.getElementById('requestsTableBody');
        
        if (requests.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No requests found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = requests.map(request => `
            <tr>
                <td>${request.title}</td>
                <td>${request.campId.campName}</td>
                <td>${request.type}</td>
                <td><span class="urgency-${request.urgency.toLowerCase()}">${request.urgency}</span></td>
                <td><span class="badge bg-${getStatusColor(request.status)}">${request.status}</span></td>
                <td>${request.raisedBy.username}</td>
                <td>
                    ${request.status === 'Pending' ? `
                        <button class="btn btn-sm btn-success me-1" onclick="updateRequestStatus('${request._id}', 'Approved')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="updateRequestStatus('${request._id}', 'Rejected')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : request.status === 'Approved' ? `
                        <button class="btn btn-sm btn-info" onclick="updateRequestStatus('${request._id}', 'Fulfilled')">
                            <i class="fas fa-check-double"></i> Fulfill
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading requests:', error);
        showAlert('Error loading requests data', 'danger');
    }
}

async function loadDonationsData() {
    try {
        const response = await fetch('/api/donations');
        const donations = await response.json();
        
        const tableBody = document.getElementById('donationsTableBody');
        
        if (donations.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No donations found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = donations.map(donation => `
            <tr>
                <td>${donation.trackingId}</td>
                <td>${donation.donorId.username}</td>
                <td>${donation.campId.campName}</td>
                <td>${donation.donationType}</td>
                <td><span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span></td>
                <td>${new Date(donation.createdAt).toLocaleDateString()}</td>
                <td>
                    ${donation.status === 'Pending' ? `
                        <button class="btn btn-sm btn-primary me-1" onclick="updateDonationStatus('${donation._id}', 'In Transit')">
                            <i class="fas fa-shipping-fast"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="updateDonationStatus('${donation._id}', 'Rejected')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : donation.status === 'In Transit' ? `
                        <button class="btn btn-sm btn-success" onclick="updateDonationStatus('${donation._id}', 'Delivered')">
                            <i class="fas fa-check"></i> Deliver
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading donations:', error);
        showAlert('Error loading donations data', 'danger');
    }
}

async function loadInventoryAlerts() {
    try {
        const response = await fetch('/api/inventory/alerts/low-stock');
        const alerts = await response.json();
        
        const alertsContainer = document.getElementById('inventoryAlerts');
        
        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<div class="alert alert-info">No low stock alerts at this time.</div>';
            return;
        }
        
        const alertsHtml = alerts.map(alert => `
            <div class="alert alert-warning">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>${alert.campName} - ${alert.campLocation}</h6>
                <p class="mb-1"><strong>${alert.itemName}</strong> (${alert.category})</p>
                <p class="mb-0">Current: ${alert.currentQuantity} ${alert.unit} | Minimum: ${alert.minThreshold} ${alert.unit}</p>
            </div>
        `).join('');
        
        alertsContainer.innerHTML = alertsHtml;
        
    } catch (error) {
        console.error('Error loading inventory alerts:', error);
        showAlert('Error loading inventory alerts', 'danger');
    }
}

async function createCamp() {
    const form = document.getElementById('createCampForm');
    const formData = new FormData(form);
    
    const campData = {
        campName: formData.get('campName') || document.getElementById('campName').value,
        location: formData.get('location') || document.getElementById('location').value,
        strength: parseInt(formData.get('strength') || document.getElementById('strength').value),
        description: formData.get('description') || document.getElementById('description').value
    };
    
    try {
        const response = await fetch('/api/camps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(campData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Camp created successfully!', 'success');
            document.getElementById('createCampForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('createCampModal')).hide();
            loadCampsData(); // Reload camps data
        } else {
            if (data.errors) {
                const errorMessages = data.errors.map(error => error.msg).join('<br>');
                showAlert(errorMessages, 'danger');
            } else {
                showAlert(data.error || 'Failed to create camp', 'danger');
            }
        }
    } catch (error) {
        console.error('Error creating camp:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

function registerOfficialForCamp(campId, campName) {
    document.getElementById('selectedCampId').value = campId;
    document.querySelector('#registerOfficialModal .modal-title').textContent = `Register Official for ${campName}`;
    new bootstrap.Modal(document.getElementById('registerOfficialModal')).show();
}

async function registerOfficial() {
    const campId = document.getElementById('selectedCampId').value;
    const formData = {
        campId: campId,
        username: document.getElementById('officialUsername').value,
        email: document.getElementById('officialEmail').value,
        password: document.getElementById('officialPassword').value,
        phoneNumber: document.getElementById('officialPhone').value
    };
    
    try {
        const response = await fetch('/api/camps/register-official', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Camp official registered successfully!', 'success');
            document.getElementById('registerOfficialForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('registerOfficialModal')).hide();
            loadCampsData(); // Reload camps data
        } else {
            if (data.errors) {
                const errorMessages = data.errors.map(error => error.msg).join('<br>');
                showAlert(errorMessages, 'danger');
            } else {
                showAlert(data.error || 'Failed to register official', 'danger');
            }
        }
    } catch (error) {
        console.error('Error registering official:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

async function updateRequestStatus(requestId, status) {
    try {
        const response = await fetch(`/api/requests/${requestId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showAlert(`Request ${status.toLowerCase()} successfully!`, 'success');
            loadRequestsData();
            loadOverviewData(); // Update overview stats
        } else {
            const data = await response.json();
            showAlert(data.error || 'Failed to update request status', 'danger');
        }
    } catch (error) {
        console.error('Error updating request status:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

async function updateDonationStatus(donationId, status) {
    try {
        const response = await fetch(`/api/donations/${donationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showAlert(`Donation status updated to ${status}!`, 'success');
            loadDonationsData();
            loadOverviewData(); // Update overview stats
        } else {
            const data = await response.json();
            showAlert(data.error || 'Failed to update donation status', 'danger');
        }
    } catch (error) {
        console.error('Error updating donation status:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'warning';
        case 'approved': return 'info';
        case 'fulfilled': return 'success';
        case 'rejected': return 'danger';
        case 'in transit': return 'primary';
        case 'delivered': return 'success';
        default: return 'secondary';
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Auto-hide success alerts
    if (type === 'success') {
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
                bsAlert.close();
            }
        }, 3000);
    }
}