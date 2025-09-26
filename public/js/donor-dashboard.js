let currentUser = null;
let availableCamps = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupSidebarNavigation();
    setupForms();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated || data.user.role !== 'Donor') {
            window.location.href = '/login';
            return;
        }
        
        currentUser = data.user;
        document.getElementById('userInfo').textContent = `${data.user.username} (${data.user.role})`;
        
        await loadCamps();
        loadOverviewData();
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

function setupForms() {
    document.getElementById('donationForm').addEventListener('submit', handleDonation);
    document.getElementById('trackingForm').addEventListener('submit', handleTracking);
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
            loadCampsGrid();
            break;
        case 'donate':
            loadDonationForm();
            break;
        case 'donations':
            loadMyDonations();
            break;
        case 'track':
            // Track section doesn't need data loading
            break;
    }
}

async function loadCamps() {
    try {
        const response = await fetch('/api/camps');
        availableCamps = await response.json();
    } catch (error) {
        console.error('Error loading camps:', error);
    }
}

async function loadOverviewData() {
    try {
        // Load user's donations and urgent requests
        await loadUrgentRequests();
        const donationsResponse = await fetch('/api/donations');
        const donations = await donationsResponse.json();
        
        // Load all requests to show urgent ones
        const requestsResponse = await fetch('/api/requests');
        const requests = await requestsResponse.json();
        
        // Update statistics
        document.getElementById('totalDonations').textContent = donations.length;
        document.getElementById('activeDonations').textContent = donations.filter(d => d.status !== 'Delivered' && d.status !== 'Rejected').length;
        document.getElementById('deliveredDonations').textContent = donations.filter(d => d.status === 'Delivered').length;
        
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
        `).join('') : '<p class="text-muted">No donations yet. <a href="#" onclick="switchToSection(\'donate\')">Make your first donation!</a></p>';
        
        document.getElementById('recentDonations').innerHTML = donationsHtml;
        
        // Display urgent requests
        const urgentRequests = requests.filter(r => r.urgency === 'Critical' || r.urgency === 'High').slice(0, 5);
        const requestsHtml = urgentRequests.length > 0 ? urgentRequests.map(request => {
            // Format items for display
            const itemsList = request.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit
            }));
            
            return `
            <div class="border-bottom pb-2 mb-2 urgent-request-card" style="cursor: pointer" onclick="handleUrgentRequestClick('${request._id}')">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${request.title}</strong>
                    <span class="badge bg-danger">${request.urgency}</span>
                </div>
                <small class="text-muted d-block">${request.campId.campName} - ${request.type}</small>
                <div class="mt-2 d-flex justify-content-between align-items-center">
                    <small class="text-muted">
                        ${request.items.map(item => `${item.quantity} ${item.unit} ${item.name}`).join(', ')}
                    </small>
                    <button class="btn btn-success btn-sm donation-btn" 
                        onclick="event.stopPropagation(); donateToCamp()">
                        <i class="fas fa-hand-holding-heart me-1"></i>Donate
                    </button>
                </div>
            </div>
        `;
        }).join('') : '<p class="text-muted">No urgent requests at this time</p>';
        
        document.getElementById('urgentRequests').innerHTML = requestsHtml;
        
    } catch (error) {
        console.error('Error loading overview data:', error);
        showAlert('Error loading dashboard data', 'danger');
    }
}

async function loadCampsGrid() {
    const campsGrid = document.getElementById('campsGrid');
    
    if (availableCamps.length === 0) {
        campsGrid.innerHTML = '<div class="col-12 text-center text-muted">No camps available</div>';
        return;
    }
    
    const campsHtml = availableCamps.map(camp => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card dashboard-card h-100">
                <div class="card-body">
                    <h5 class="card-title">${camp.campName}</h5>
                    <p class="text-muted mb-2">
                        <i class="fas fa-map-marker-alt me-1"></i>${camp.location}
                    </p>
                    <p class="text-muted mb-2">
                        <i class="fas fa-users me-1"></i>Capacity: ${camp.strength} people
                    </p>
                    <p class="text-muted mb-3">
                        <i class="fas fa-user-tie me-1"></i>Officials: ${camp.assignedOfficials.length}
                    </p>
                    <div class="d-grid">
                        <button class="btn btn-primary" onclick="selectCampForDonation('${camp._id}', '${camp.campName}')">
                            <i class="fas fa-gift me-2"></i>Donate to Camp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    campsGrid.innerHTML = campsHtml;
}

function loadDonationForm() {
    // Populate camp dropdown
    const campSelect = document.getElementById('donationCamp');
    campSelect.innerHTML = '<option value="">Select a camp</option>' + 
        availableCamps.map(camp => 
            `<option value="${camp._id}">${camp.campName} - ${camp.location}</option>`
        ).join('');
}

async function loadMyDonations() {
    try {
        const response = await fetch('/api/donations');
        const donations = await response.json();
        
        const tableBody = document.getElementById('donationsTableBody');
        
        if (donations.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No donations found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = donations.map(donation => `
            <tr>
                <td>${donation.trackingId}</td>
                <td>${donation.campId.campName}</td>
                <td>${donation.donationType}</td>
                <td><span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span></td>
                <td>${new Date(donation.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="showDonationDetails('${donation._id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading donations:', error);
        showAlert('Error loading donations data', 'danger');
    }
}

function selectCampForDonation(campId, campName) {
    // Switch to donate section
    switchSection('donate');
    document.querySelectorAll('.list-group-item[data-section]').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.list-group-item[data-section="donate"]').classList.add('active');
    
    // Pre-select the camp
    document.getElementById('donationCamp').value = campId;
    showAlert(`Selected camp: ${campName}`, 'info');
}

function switchToSection(section) {
    switchSection(section);
    document.querySelectorAll('.list-group-item[data-section]').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.list-group-item[data-section="${section}"]`).classList.add('active');
}

function addDonationItem() {
    const itemsContainer = document.getElementById('donationItems');
    const itemRow = document.createElement('div');
    itemRow.className = 'donation-item-row row mb-2';
    itemRow.innerHTML = `
        <div class="col-md-4">
            <input type="text" class="form-control" placeholder="Item name" required>
        </div>
        <div class="col-md-3">
            <input type="number" class="form-control" placeholder="Quantity" min="1" required>
        </div>
        <div class="col-md-3">
            <input type="text" class="form-control" placeholder="Unit" required>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeDonationItem(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    itemsContainer.appendChild(itemRow);
}

function removeDonationItem(button) {
    const itemsContainer = document.getElementById('donationItems');
    if (itemsContainer.children.length > 1) {
        const itemRow = button.closest('.donation-item-row');
        itemRow.remove();
    }
}

async function handleDonation(e) {
    e.preventDefault();
    
    const campId = document.getElementById('donationCamp').value;
    const donationType = document.getElementById('donationType').value;
    const message = document.getElementById('donationMessage').value;
    
    // Collect items
    const itemRows = document.querySelectorAll('.donation-item-row');
    const items = [];
    
    for (const row of itemRows) {
        const inputs = row.querySelectorAll('input');
        const item = {
            name: inputs[0].value.trim(),
            quantity: parseInt(inputs[1].value),
            unit: inputs[2].value.trim()
        };
        
        if (item.name && item.quantity && item.unit) {
            items.push(item);
        }
    }
    
    if (items.length === 0) {
        showAlert('Please add at least one item', 'danger');
        return;
    }
    
    const donationData = {
        campId,
        donationType,
        items,
        message
    };
    
    try {
        const response = await fetch('/api/donations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(donationData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert(`Donation submitted successfully! Tracking ID: ${data.trackingId}`, 'success');
            
            // Reset form
            document.getElementById('donationForm').reset();
            const itemsContainer = document.getElementById('donationItems');
            itemsContainer.innerHTML = `
                <div class="donation-item-row row mb-2">
                    <div class="col-md-4">
                        <input type="text" class="form-control" placeholder="Item name" required>
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control" placeholder="Quantity" min="1" required>
                    </div>
                    <div class="col-md-3">
                        <input type="text" class="form-control" placeholder="Unit" required>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-danger btn-sm" onclick="removeDonationItem(this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Reload donation form camp options
            loadDonationForm();
        } else {
            if (data.errors) {
                const errorMessages = data.errors.map(error => error.msg).join('<br>');
                showAlert(errorMessages, 'danger');
            } else {
                showAlert(data.error || 'Failed to submit donation', 'danger');
            }
        }
    } catch (error) {
        console.error('Error submitting donation:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

async function handleTracking(e) {
    e.preventDefault();
    
    const trackingId = document.getElementById('trackingId').value.trim();
    const resultContainer = document.getElementById('trackingResult');
    
    if (!trackingId) {
        showAlert('Please enter a tracking ID', 'danger');
        return;
    }
    
    try {
        const response = await fetch(`/api/donations/track/${trackingId}`);
        
        if (response.ok) {
            const donation = await response.json();
            
            const resultHtml = `
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">Donation Details - ${donation.trackingId}</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Camp:</strong> ${donation.campId.campName}</p>
                                <p><strong>Location:</strong> ${donation.campId.location}</p>
                                <p><strong>Type:</strong> ${donation.donationType}</p>
                                <p><strong>Status:</strong> <span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span></p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Date Submitted:</strong> ${new Date(donation.createdAt).toLocaleString()}</p>
                                <p><strong>Last Updated:</strong> ${new Date(donation.updatedAt).toLocaleString()}</p>
                                ${donation.message ? `<p><strong>Message:</strong> ${donation.message}</p>` : ''}
                            </div>
                        </div>
                        
                        <h6 class="mt-3">Items:</h6>
                        <ul class="list-group list-group-flush">
                            ${donation.items.map(item => `
                                <li class="list-group-item">
                                    ${item.name} - ${item.quantity} ${item.unit}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
            
            resultContainer.innerHTML = resultHtml;
        } else if (response.status === 404) {
            resultContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No donation found with tracking ID: ${trackingId}
                </div>
            `;
        } else {
            throw new Error('Failed to track donation');
        }
    } catch (error) {
        console.error('Error tracking donation:', error);
        resultContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                Error tracking donation. Please try again.
            </div>
        `;
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
        }, 5000);
    }
}

async function handleOverviewDonation(requestData) {
    try {
        // Switch to donation section first
        switchSection('donate');
        
        // Update the sidebar active state
        document.querySelectorAll('.list-group-item[data-section]').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.list-group-item[data-section="donate"]').classList.add('active');

        // Wait for the donation form to be loaded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set the camp
        document.getElementById('donationCamp').value = requestData.campId;

        // Get the items container and clear existing items
        const itemsContainer = document.getElementById('donationItems');
        itemsContainer.innerHTML = '';

        // Add each item from the request
        requestData.items.forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'donation-item-row row mb-2';
            itemRow.innerHTML = `
                <div class="col-md-4">
                    <input type="text" class="form-control" placeholder="Item name" value="${item.name}" required>
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control" placeholder="Quantity" min="1" value="${item.quantity}" required>
                </div>
                <div class="col-md-3">
                    <input type="text" class="form-control" placeholder="Unit" value="${item.unit}" required>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeDonationItem(this)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            itemsContainer.appendChild(itemRow);
        });
        
        // Set the donation type based on the request type
        const donationType = document.getElementById('donationType');
        if (donationType) {
            donationType.value = requestData.type || 'Other';
        }

        // Add a message indicating this is from an urgent request
        const messageField = document.getElementById('donationMessage');
        if (messageField) {
            messageField.value = `Urgent request response - Request ID: ${requestData.id}\nDonating to: ${requestData.campName}`;
        }
        
        // Scroll to donation form
        document.getElementById('donate').scrollIntoView({ behavior: 'smooth' });
        
        // Show helper message
        showAlert('Donation form has been pre-filled based on the urgent request. Please review and submit.', 'info');
    } catch (error) {
        console.error('Error preparing donation:', error);
        showAlert('Error preparing donation form. Please try again.', 'danger');
    }
}

async function handleUrgentRequestClick(requestId) {
    try {
        // Check if the click was on the donate button
        const target = event.target;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
            return; // Let the button's own click handler handle it
        }
        
        // Otherwise, proceed with donation form
        await donateToCamp();
    } catch (error) {
        console.error('Error handling urgent request click:', error);
        showAlert('Error preparing donation form. Please try again.', 'danger');
    }
}

async function loadUrgentRequests() {
    try {
        const response = await fetch('/api/requests/urgent');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const urgentRequests = await response.json();
        
        const container = document.getElementById('urgentRequests');
        if (!urgentRequests || urgentRequests.length === 0) {
            container.innerHTML = '<p class="text-muted">No urgent requests at the moment.</p>';
            return;
        }

        container.innerHTML = urgentRequests.map(request => `
            <div class="urgent-request-item mb-2 p-2 border rounded">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${request.itemName}</strong>
                        <small class="text-muted d-block">Camp: ${request.campName}</small>
                        <small class="text-muted d-block">Need: ${request.quantity} ${request.unit}</small>
                    </div>
                    <button class="btn btn-success btn-sm" onclick="donateToCamp()">
                        <i class="fas fa-hand-holding-heart me-1"></i>Donate
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading urgent requests:', error);
        showAlert('Error loading urgent requests. Please try again.', 'danger');
    }
}

async function viewUrgentDetails() {
    try {
        const response = await fetch('/api/requests/urgent');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const urgentRequests = await response.json();
        
        // Remove any existing event listeners from old modals
        const oldModal = document.getElementById('urgentDetailsModal');
        if (oldModal) {
            const oldModalInstance = bootstrap.Modal.getInstance(oldModal);
            if (oldModalInstance) {
                oldModalInstance.dispose();
            }
            oldModal.remove();
        }
        
        const modalContent = urgentRequests.length === 0 ? 
            '<p class="text-muted">No urgent requests at the moment.</p>' :
            `<div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>Item Name</th>
                            <th>Camp</th>
                            <th>Quantity Needed</th>
                            <th>Priority</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${urgentRequests.map(request => `
                            <tr>
                                <td>
                                    <strong>${request.itemName}</strong>
                                    <small class="text-muted d-block">Type: ${request.type || 'General'}</small>
                                </td>
                                <td>
                                    <span>${request.campName}</span>
                                    ${request.location ? `<small class="text-muted d-block">${request.location}</small>` : ''}
                                </td>
                                <td>
                                    <span class="badge bg-info text-dark">${request.quantity} ${request.unit}</span>
                                </td>
                                <td>
                                    <span class="badge bg-danger">Urgent</span>
                                </td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="donateToCamp()" data-request-id="${request._id}">
                                        <i class="fas fa-hand-holding-heart me-1"></i>Donate Now
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        const modalHtml = `
            <div class="modal fade" id="urgentDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Urgent Requests Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${modalContent}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('urgentDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('urgentDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading urgent request details:', error);
        showAlert('Error loading urgent request details. Please try again.', 'danger');
    }
}

async function donateToCamp() {
    try {
        // Close the modal if it's open
        const modalElement = document.getElementById('urgentDetailsModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }

        // Simply navigate to the Donate section
        switchSection('donate');

        // Update the sidebar active state
        document.querySelectorAll('.list-group-item[data-section]').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.list-group-item[data-section="donate"]').classList.add('active');

        // Scroll into view
        document.getElementById('donate').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error navigating to donation form:', error);
        showAlert('Unable to open donation form. Please try again.', 'danger');
    }
}