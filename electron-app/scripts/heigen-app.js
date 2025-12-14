// ==============================================
// HEIGEN ADMIN SYSTEM - MAIN APPLICATION
// ==============================================

// Global State Management
const AppState = {
    currentUser: null,
    currentScreen: 'login',
    customers: [],
    packages: [],
    addons: [],
    selectedCustomer: null,
};

// ==============================================
// NAVIGATION & ROUTING
// ==============================================

function navigateTo(screen) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(`${screen}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        AppState.currentScreen = screen;

        // Update sidebar active state
        updateSidebarActiveState(screen);

        // Load screen-specific data
        loadScreenData(screen);
    }
}

function updateSidebarActiveState(screen) {
    document.querySelectorAll('[id^="nav-"]').forEach(el => {
        el.classList.remove('sidebar-active');
    });

    const activeNav = document.getElementById(`nav-${screen}`);
    if (activeNav) {
        activeNav.classList.add('sidebar-active');
    }
}


function loadScreenData(screen) {
    switch(screen) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'customers':
            cloneSidebar('customers');
            loadCustomersData();
            break;
        case 'packages':
            cloneSidebar('packages');
            loadPackagesData();
            break;
    }
}

// Clone sidebar for screens that need it
function cloneSidebar(screen) {
    const targetContainer = document.getElementById(`sidebar-${screen}`);
    if (!targetContainer) return;

    const dashboardScreen = document.getElementById('dashboard-screen');
    const sidebar = dashboardScreen.querySelector('.heigen-sidebar');
    
    if (sidebar && targetContainer.children.length === 0) {
        const clone = sidebar.cloneNode(true);
        targetContainer.appendChild(clone);
        
        // Re-attach event listeners
        clone.querySelectorAll('a[onclick]').forEach(link => {
            const onclick = link.getAttribute('onclick');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                eval(onclick);
            });
        });
    }
}

// ==============================================
// TOAST NOTIFICATIONS
// ==============================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toast.classList.remove('toast-success', 'toast-error', 'toast-info');
    toast.classList.add(`toast-${type}`);
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==============================================
// MODAL MANAGEMENT
// ==============================================

function showSuccessModal(title, subtitle) {
    const modal = document.getElementById('success-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-subtitle').textContent = subtitle;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('success-modal').classList.remove('active');
    navigateTo('login');
}

// ==============================================
// FORM HANDLERS
// ==============================================

// Login Form
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Validate
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    showToast('Signing in...', 'info');

    try {
        // TODO: API CALL
        const result = await API.login(email, password);

        if (!result.success) {
            throw new Error(result.error || 'Login failed');
        }

        AppState.currentUser = result.user;

        showToast('Login successful!', 'success');
        
        setTimeout(() => {
            navigateTo('dashboard');
        }, 1000);
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
    }
});

// Signup Form
document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    // Validate
    if (!name || !email || !password || !confirm) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        // TODO: API CALL
        const result = await API.signup(name, email, password);

        if (!result.success) {
            throw new Error(result.error || 'Signup failed');
        }

        
        showSuccessModal('Account created successfully!', 'Go back to sign in page');
    } catch (error) {
        showToast(error.message || 'Signup failed', 'error');
    }
});

// Reset Password Form
document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    // Validate
    if (!email || !newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        // TODO: API CALL
        const result = await API.resetPassword(email, newPassword);

        if (!result.success) {
            throw new Error(result.error || 'Reset failed');
        }

        
        showSuccessModal('Password changed successfully!', 'Go back to sign in page');
    } catch (error) {
        showToast(error.message || 'Password reset failed', 'error');
    }
});

// ==============================================
// DASHBOARD DATA
// ==============================================

async function loadDashboardData() {
    try {
        // TODO: API CALL - Load dashboard statistics
        const stats = await API.getDashboardStats();
        
        // Update dashboard UI with stats
        console.log('Dashboard stats loaded:', stats);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// ==============================================
// CUSTOMERS DATA
// ==============================================

async function loadCustomersData() {
    try {
        // TODO: API CALL - Load customers list
        const result = await API.getCustomers();
        AppState.customers = result.customers;
        renderCustomersTable(result.customers);

    } catch (error) {
        console.error('Failed to load customers:', error);
        showToast('Failed to load customers', 'error');
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    tbody.innerHTML = customers.map((customer, index) => `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-3">
                <input type="checkbox" class="rounded" data-customer-id="${customer.id}">
            </td>
            <td class="py-3 text-gray-600 text-sm">${index + 1}</td>
            <td class="py-3 text-gray-600 text-sm">${customer.name}</td>
            <td class="py-3 text-gray-600 text-sm">${customer.email}</td>
            <td class="py-3 text-gray-600 text-sm">${customer.contact}</td>
            <td class="py-3 text-gray-600 text-sm">${customer.consent}</td>
            <td class="py-3 text-gray-600 text-sm">${customer.bookings}</td>
            <td class="py-3">
                <button onclick="viewCustomerDetails(${customer.id})" 
                        class="text-blue-600 hover:underline text-sm">
                    View Details
                </button>
            </td>
        </tr>
    `).join('');
}

async function viewCustomerDetails(customerId) {
    try {
        // TODO: API CALL - Load customer details
        const customer = await API.getCustomerDetails(customerId);
        
        AppState.selectedCustomer = customer;
        
        // TODO: Navigate to customer details view
        // This would need a separate screen implementation
        showToast(`Viewing details for ${customer.name}`, 'info');
    } catch (error) {
        console.error('Failed to load customer details:', error);
        showToast('Failed to load customer details', 'error');
    }
}

// ==============================================
// PACKAGES DATA
// ==============================================

let currentPackageTab = 'packages';

function switchPackageTab(tab) {
    currentPackageTab = tab;
    
    // Update tab buttons
    const packagesTab = document.getElementById('tab-packages');
    const addonsTab = document.getElementById('tab-addons');
    
    if (tab === 'packages') {
        packagesTab.classList.add('bg-[#FFE8AD]', 'text-[#4F6E79]');
        packagesTab.classList.remove('bg-transparent', 'text-[#FFE8AD]');
        addonsTab.classList.remove('bg-[#FFE8AD]', 'text-[#4F6E79]');
        addonsTab.classList.add('bg-transparent', 'text-[#FFE8AD]');
        
        document.getElementById('packages-content').classList.remove('hidden');
        document.getElementById('addons-content').classList.add('hidden');
    } else {
        addonsTab.classList.add('bg-[#FFE8AD]', 'text-[#4F6E79]');
        addonsTab.classList.remove('bg-transparent', 'text-[#FFE8AD]');
        packagesTab.classList.remove('bg-[#FFE8AD]', 'text-[#4F6E79]');
        packagesTab.classList.add('bg-transparent', 'text-[#FFE8AD]');
        
        document.getElementById('addons-content').classList.remove('hidden');
        document.getElementById('packages-content').classList.add('hidden');
    }
}

async function loadPackagesData() {
    try {
        // TODO: API CALL - Load packages and addons
        const [packagesRes, addonsRes] = await Promise.all([
            API.getPackages(),
            API.getAddons()
        ]);

        AppState.packages = packagesRes.packages;
        AppState.addons = addonsRes.addons;

        renderPackages(packagesRes.packages);
        renderAddons(addonsRes.addons);

    } catch (error) {
        console.error('Failed to load packages:', error);
        showToast('Failed to load packages', 'error');
    }
}

function renderPackages(packages) {
    const container = document.getElementById('packages-content');
    if (!container) return;

    const packagesHTML = packages.map(pkg => `
        <div class="package-card overflow-hidden">
            <img src="${pkg.image || 'https://api.builder.io/api/v1/image/assets/TEMP/463ec005acfb120561dbbc1c43a4db8fadcb9914?width=648'}" 
                 alt="${pkg.name}" 
                 class="w-full h-40 object-cover">
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="text-[#4F6E79] text-lg font-bold">${pkg.name}</h3>
                    <button onclick="editPackage(${pkg.id})" class="text-[#4F6E79] hover:opacity-70">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                    </button>
                </div>
                <p class="text-[#4F6E79] text-sm font-bold mb-1">₱${pkg.price.toFixed(2)}</p>
                <p class="text-gray-500 text-xs mb-2">${pkg.description}</p>
                <button class="text-[#7DA3AC] text-sm font-semibold hover:underline">Read more</button>
            </div>
        </div>
    `).join('');

    const createNewCard = `
        <div class="package-card border-4 border-dashed border-[#BDDAE0] flex items-center justify-center h-72 cursor-pointer hover:border-[#8FA9B3]" 
             onclick="createNewPackage()">
            <span class="text-[#BDDAE0] text-base font-bold">CREATE PACKAGE</span>
        </div>
    `;

    container.innerHTML = packagesHTML + createNewCard;
}

function renderAddons(addons) {
    const container = document.getElementById('addons-content');
    if (!container) return;

    const addonsHTML = addons.map(addon => `
        <div class="bg-white rounded-2xl p-4 shadow">
            <div class="flex items-start justify-between mb-2">
                <h3 class="text-[#4F6E79] text-base font-bold">${addon.name}</h3>
                <button onclick="editAddon(${addon.id})" class="text-[#4F6E79] hover:opacity-70">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                </button>
            </div>
            <p class="text-[#4F6E79] text-xs font-bold mb-1">₱${addon.price.toFixed(2)}</p>
            <p class="text-gray-500 text-xs">${addon.description}</p>
        </div>
    `).join('');

    const createNewCard = `
        <div class="border-4 border-dashed border-[#BDDAE0] rounded-2xl flex items-center justify-center h-28 cursor-pointer hover:border-[#8FA9B3]" 
             onclick="createNewAddon()">
            <span class="text-[#BDDAE0] text-sm font-bold">NEW ADDON</span>
        </div>
    `;

    container.innerHTML = addonsHTML + createNewCard;
}

async function editPackage(packageId) {
    try {
        // TODO: API CALL - Load package details for editing
        const pkg = await API.getPackageDetails(packageId);
        
        // TODO: Show edit modal/form
        showToast(`Editing package: ${pkg.name}`, 'info');
    } catch (error) {
        console.error('Failed to load package details:', error);
        showToast('Failed to load package', 'error');
    }
}

async function createNewPackage() {
    // TODO: Show create package modal/form
    showToast('Create new package functionality', 'info');
}

async function editAddon(addonId) {
    try {
        // TODO: API CALL - Load addon details for editing
        const addon = await API.getAddonDetails(addonId);
        
        // TODO: Show edit modal/form
        showToast(`Editing addon: ${addon.name}`, 'info');
    } catch (error) {
        console.error('Failed to load addon details:', error);
        showToast('Failed to load addon', 'error');
    }
}

async function createNewAddon() {
    // TODO: Show create addon modal/form
    showToast('Create new addon functionality', 'info');
}

// ==============================================
// LOGOUT
// ==============================================

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AppState.currentUser = null;
        AppState.customers = [];
        AppState.packages = [];
        AppState.addons = [];
        
        showToast('Logged out successfully', 'success');
        
        setTimeout(() => {
            navigateTo('login');
        }, 500);
    }
}

// ==============================================
// INITIALIZATION
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Heigen Admin System initialized');
    
    // Check if user is already logged in (from localStorage/sessionStorage)
    const savedUser = localStorage.getItem('heigen_user');
    if (savedUser) {
        try {
            AppState.currentUser = JSON.parse(savedUser);
            navigateTo('dashboard');
        } catch (error) {
            console.error('Failed to restore user session:', error);
        }
    }
});

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatCurrency(amount) {
    return `₱${amount.toFixed(2)}`;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
