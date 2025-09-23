let currentUser = null;
let userCamp = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupSidebarNavigation();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated || data.user.role !== 'CampOfficial') {
            window.location.href = '/login';
            return;
        }
        
        currentUser = data.user;
        document.getElementById('userInfo').textContent = `${data.user.username} (${data.user.role})`;
        
        // Load user's assigned camp
        await loadUserCamp();
        loadOverviewData();
    } catch (error) {
        console.error('Authentication check error:', error);
        window.location.href = '/login';
    }
}

async function loadUserCamp() {
    try {
        // Get user details to find assigned camp
        const userResponse = await fetch(`/api/auth/status`);
        const userData = await userResponse.json();
        
        if (userData.authenticated) {
            // We'll need to implement a way to get the user's assigned camp
            // For now, we'll load all camps and filter by assigned officials
            const campsResponse = await fetch('/api/camps');
            const camps = await campsResponse.json();
            
            // Find camp where current user is an assigned official
            userCamp = camps.find(camp => 
                camp.assignedOfficials.some(official => official._id === currentUser.id)
            );
            
            if (userCamp) {
                displayCampInfo();
            }
        }
    } catch (error) {
        console.error('Error loading user camp:', error);
    }
}

function displayCampInfo() {
    if (!userCamp) return;
    
    const campDetails = document.getElementById('campDetails');
    campDetails.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Camp Name:</strong> ${userCamp.campName}</p>
                <p><strong>Location:</strong> ${userCamp.location}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Capacity:</strong> ${userCamp.strength} people</p>
                <p><strong>Status:</strong> <span class="badge bg-${userCamp.status === 'Active' ? 'success' : 'secondary'}">${userCamp.status}</span></p>
            </div>
        </div>
        <p><strong>Description:</strong> ${userCamp.description || 'No description provided'}</p>
    `;
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
        case 'inventory':
            loadInventoryData();
            break;
        case 'requests':
            loadRequestsData();
            break;
        case 'donations':
            loadDonationsData();
            break;
    }
}

async function loadOverviewData() {
    if (!userCamp) return;
    
    try {
        // Load requests for this camp
        const requestsResponse = await fetch('/api/requests');
        const requests = await requestsResponse.json();
        const campRequests = requests.filter(r => r.campId._id === userCamp._id);
        
        // Load donations for this camp
        const donationsResponse = await fetch('/api/donations');
        const donations = await donationsResponse.json();
        const campDonations = donations.filter(d => d.campId._id === userCamp._id);
        
        // Load inventory
        const inventoryResponse = await fetch(`/api/inventory/${userCamp._id}`);
        let inventoryItems = [];
        if (inventoryResponse.ok) {
            const inventory = await inventoryResponse.json();
            inventoryItems = inventory.items || [];
        }
        
        // Update statistics
        document.getElementById('inventoryItems').textContent = inventoryItems.length;
        document.getElementById('activeRequests').textContent = campRequests.filter(r => r.status !== 'Fulfilled' && r.status !== 'Rejected').length;
        document.getElementById('pendingDonations').textContent = campDonations.filter(d => d.status === 'Pending').length;
        
        // Display recent requests
        const recentRequests = campRequests.slice(0, 5);
        const requestsHtml = recentRequests.length > 0 ? recentRequests.map(request => `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${request.title}</strong>
                    <span class="badge bg-${getStatusColor(request.status)}">${request.status}</span>
                </div>
                <small class="text-muted">${request.type} - ${request.urgency} priority</small>
            </div>
        `).join('') : '<p class="text-muted">No recent requests</p>';
        
        document.getElementById('recentRequests').innerHTML = requestsHtml;
        
        // Display low stock items
        const lowStockItems = inventoryItems.filter(item => item.quantity <= item.minThreshold);
        const lowStockHtml = lowStockItems.length > 0 ? lowStockItems.map(item => `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${item.name}</strong>
                    <span class="text-danger">${item.quantity} ${item.unit}</span>
                </div>
                <small class="text-muted">Min: ${item.minThreshold} ${item.unit}</small>
            </div>
        `).join('') : '<p class="text-muted">All items are adequately stocked</p>';
        
        document.getElementById('lowStockItems').innerHTML = lowStockHtml;
        
    } catch (error) {
        console.error('Error loading overview data:', error);
        showAlert('Error loading dashboard data', 'danger');
    }
}

async function loadInventoryData() {
    if (!userCamp) return;
    
    try {
        const response = await fetch(`/api/inventory/${userCamp._id}`);
        
        if (!response.ok) {
            document.getElementById('inventoryList').innerHTML = '<p class="text-muted">No inventory data found</p>';
            return;
        }
        
        const inventory = await response.json();
        const items = inventory.items || [];
        
        if (items.length === 0) {
            document.getElementById('inventoryList').innerHTML = '<p class="text-muted">No items in inventory</p>';
            return;
        }
        
        const inventoryHtml = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Quantity</th>
                            <th>Category</th>
                            <th>Min Threshold</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity} ${item.unit}</td>
                                <td>${item.category}</td>
                                <td>${item.minThreshold} ${item.unit}</td>
                                <td>
                                    ${item.quantity <= item.minThreshold ? 
                                        '<span class="badge bg-danger">Low Stock</span>' : 
                                        '<span class="badge bg-success">In Stock</span>'
                                    }
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-primary me-1" onclick="editInventoryItem(${index})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="removeInventoryItem(${index})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('inventoryList').innerHTML = inventoryHtml;
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showAlert('Error loading inventory data', 'danger');
    }
}

async function loadRequestsData() {
    try {
        const response = await fetch('/api/requests');
        const requests = await response.json();
        
        // Filter requests for this camp
        const campRequests = userCamp ? requests.filter(r => r.campId._id === userCamp._id) : requests;
        
        const tableBody = document.getElementById('requestsTableBody');
        
        if (campRequests.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No requests found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = campRequests.map(request => `
            <tr>
                <td>${request.title}</td>
                <td>${request.type}</td>
                <td><span class="urgency-${request.urgency.toLowerCase()}">${request.urgency}</span></td>
                <td><span class="badge bg-${getStatusColor(request.status)}">${request.status}</span></td>
                <td>${new Date(request.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="showRequestItems('${request._id}', '${request.title}')">
                        <i class="fas fa-list"></i> View Items
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading requests:', error);
        showAlert('Error loading requests data', 'danger');
    }
}

async function loadDonationsData() {
    if (!userCamp) return;
    
    try {
        const response = await fetch('/api/donations');
        const donations = await response.json();
        
        // Filter donations for this camp
        const campDonations = donations.filter(d => d.campId._id === userCamp._id);
        
        const tableBody = document.getElementById('donationsTableBody');
        
        if (campDonations.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No donations found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = campDonations.map(donation => `
            <tr>
                <td>${donation.trackingId}</td>
                <td>${donation.donorId.username}</td>
                <td>${donation.donationType}</td>
                <td><span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span></td>
                <td>${new Date(donation.createdAt).toLocaleDateString()}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="showDonationItems('${donation._id}', '${donation.trackingId}')">
                            <i class="fas fa-list"></i> View Items
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="updateDonationStatus('${donation._id}')">
                            <i class="fas fa-edit"></i> Update Status
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading donations:', error);
        showAlert('Error loading donations data', 'danger');
    }
}

async function addInventoryItem() {
    if (!userCamp) {
        showAlert('No camp assigned', 'danger');
        return;
    }
    
    const itemData = {
        name: document.getElementById('itemName').value,
        quantity: parseInt(document.getElementById('itemQuantity').value),
        unit: document.getElementById('itemUnit').value,
        category: document.getElementById('itemCategory').value,
        minThreshold: parseInt(document.getElementById('minThreshold').value) || 10
    };
    
    try {
        // Get current inventory
        const response = await fetch(`/api/inventory/${userCamp._id}`);
        let items = [];
        
        if (response.ok) {
            const inventory = await response.json();
            items = inventory.items || [];
        }
        
        // Add new item
        items.push(itemData);
        
        // Update inventory
        const updateResponse = await fetch(`/api/inventory/${userCamp._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });
        
        if (updateResponse.ok) {
            showAlert('Item added successfully!', 'success');
            document.getElementById('addItemForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
            loadInventoryData();
            loadOverviewData();
        } else {
            const data = await updateResponse.json();
            showAlert(data.error || 'Failed to add item', 'danger');
        }
    } catch (error) {
        console.error('Error adding inventory item:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

function addRequestItem() {
    const itemsContainer = document.getElementById('requestItems');
    const itemRow = document.createElement('div');
    itemRow.className = 'request-item-row row mb-2';
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
            <button type="button" class="btn btn-danger btn-sm" onclick="removeRequestItem(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    itemsContainer.appendChild(itemRow);
}

function removeRequestItem(button) {
    const itemRow = button.closest('.request-item-row');
    itemRow.remove();
}

async function createRequest() {
    if (!userCamp) {
        showAlert('No camp assigned', 'danger');
        return;
    }
    
    const title = document.getElementById('requestTitle').value;
    const type = document.getElementById('requestType').value;
    const urgency = document.getElementById('requestUrgency').value;
    const description = document.getElementById('requestDescription').value;
    
    // Collect items
    const itemRows = document.querySelectorAll('.request-item-row');
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
    
    const requestData = {
        title,
        type,
        urgency,
        description,
        items
    };
    
    try {
        const response = await fetch('/api/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Request created successfully!', 'success');
            document.getElementById('createRequestForm').reset();
            // Reset items to one row
            const itemsContainer = document.getElementById('requestItems');
            itemsContainer.innerHTML = `
                <div class="request-item-row row mb-2">
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
                        <button type="button" class="btn btn-danger btn-sm" onclick="removeRequestItem(this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            bootstrap.Modal.getInstance(document.getElementById('createRequestModal')).hide();
            loadRequestsData();
            loadOverviewData();
        } else {
            if (data.errors) {
                const errorMessages = data.errors.map(error => error.msg).join('<br>');
                showAlert(errorMessages, 'danger');
            } else {
                showAlert(data.error || 'Failed to create request', 'danger');
            }
        }
    } catch (error) {
        console.error('Error creating request:', error);
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

async function showDonationItems(donationId, trackingId) {
    try {
        // Get donation with populated items
        const response = await fetch(`/api/donations/${donationId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch donation details');
        }
        const donation = await response.json();
        
        const modalHtml = `
            <div class="modal fade" id="viewDonationModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Donation Items - ${trackingId}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Quantity</th>
                                            <th>Unit</th>
                                            <th>Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${donation.items.map(item => `
                                            <tr>
                                                <td>${item.name}</td>
                                                <td>${item.quantity}</td>
                                                <td>${item.unit}</td>
                                                <td>${item.category || 'N/A'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('viewDonationModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('viewDonationModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading donation items:', error);
        showAlert('Error loading donation items', 'danger');
    }
}

async function updateDonationStatus(donationId) {
    try {
        // Get donation details first
        const response = await fetch(`/api/donations/${donationId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch donation details');
        }
        const donation = await response.json();
        
        const modalHtml = `
            <div class="modal fade" id="updateDonationStatusModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Update Donation Status</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="updateDonationStatusForm">
                                <div class="mb-3">
                                    <label class="form-label">Current Status: <span class="badge bg-${getStatusColor(donation.status)}">${donation.status}</span></label>
                                </div>
                                <div class="mb-3">
                                    <label for="newStatus" class="form-label">New Status</label>
                                    <select class="form-select" id="newStatus" required>
                                        <option value="Pending" ${donation.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                        <option value="Approved" ${donation.status === 'Approved' ? 'selected' : ''}>Approved</option>
                                        <option value="In Transit" ${donation.status === 'In Transit' ? 'selected' : ''}>In Transit</option>
                                        <option value="Delivered" ${donation.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                        <option value="Rejected" ${donation.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="saveDonationStatus('${donationId}')">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('updateDonationStatusModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('updateDonationStatusModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading donation:', error);
        showAlert('Error loading donation details', 'danger');
    }
}

async function saveDonationStatus(donationId) {
    try {
        const newStatus = document.getElementById('newStatus').value;
        
        const response = await fetch(`/api/donations/${donationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showAlert('Donation status updated successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('updateDonationStatusModal'));
            modal.hide();
            loadDonationsData(); // Refresh the donations table
            loadOverviewData(); // Refresh overview statistics
        } else {
            const data = await response.json();
            showAlert(data.error || 'Failed to update donation status', 'danger');
        }
    } catch (error) {
        console.error('Error updating donation status:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

async function editInventoryItem(index) {
    if (!userCamp) {
        showAlert('No camp assigned', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/inventory/${userCamp._id}`);
        const inventory = await response.json();
        const items = inventory.items || [];
        const item = items[index];

        if (!item) {
            showAlert('Item not found', 'danger');
            return;
        }

        const modalHtml = `
            <div class="modal fade" id="editItemModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Inventory Item</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editItemForm">
                                <div class="mb-3">
                                    <label for="editItemName" class="form-label">Item Name</label>
                                    <input type="text" class="form-control" id="editItemName" value="${item.name}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editItemQuantity" class="form-label">Quantity</label>
                                    <input type="number" class="form-control" id="editItemQuantity" value="${item.quantity}" min="0" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editItemUnit" class="form-label">Unit</label>
                                    <input type="text" class="form-control" id="editItemUnit" value="${item.unit}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editItemCategory" class="form-label">Category</label>
                                    <input type="text" class="form-control" id="editItemCategory" value="${item.category}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editMinThreshold" class="form-label">Minimum Threshold</label>
                                    <input type="number" class="form-control" id="editMinThreshold" value="${item.minThreshold}" min="0" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="saveInventoryEdit(${index})">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('editItemModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add new modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('editItemModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading item details:', error);
        showAlert('Error loading item details', 'danger');
    }
}

async function saveInventoryEdit(index) {
    if (!userCamp) {
        showAlert('No camp assigned', 'danger');
        return;
    }

    try {
        const response = await fetch(`/api/inventory/${userCamp._id}`);
        const inventory = await response.json();
        const items = inventory.items || [];

        // Update the item at the specified index
        items[index] = {
            name: document.getElementById('editItemName').value,
            quantity: parseInt(document.getElementById('editItemQuantity').value),
            unit: document.getElementById('editItemUnit').value,
            category: document.getElementById('editItemCategory').value,
            minThreshold: parseInt(document.getElementById('editMinThreshold').value)
        };

        // Save the updated inventory
        const updateResponse = await fetch(`/api/inventory/${userCamp._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });

        if (updateResponse.ok) {
            showAlert('Item updated successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('editItemModal'));
            modal.hide();
            loadInventoryData();
            loadOverviewData();
        } else {
            const data = await updateResponse.json();
            showAlert(data.error || 'Failed to update item', 'danger');
        }
    } catch (error) {
        console.error('Error updating inventory item:', error);
        showAlert('Network error. Please try again.', 'danger');
    }
}

async function removeInventoryItem(index) {
    if (!userCamp) {
        showAlert('No camp assigned', 'danger');
        return;
    }

    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }

    try {
        const response = await fetch(`/api/inventory/${userCamp._id}`);
        const inventory = await response.json();
        const items = inventory.items || [];

        // Remove the item at the specified index
        items.splice(index, 1);

        // Save the updated inventory
        const updateResponse = await fetch(`/api/inventory/${userCamp._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });

        if (updateResponse.ok) {
            showAlert('Item removed successfully!', 'success');
            loadInventoryData();
            loadOverviewData();
        } else {
            const data = await updateResponse.json();
            showAlert(data.error || 'Failed to remove item', 'danger');
        }
    } catch (error) {
        console.error('Error removing inventory item:', error);
        showAlert('Network error. Please try again.', 'danger');
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