// ==============================================
// HEIGEN ADMIN SYSTEM - MAIN APPLICATION
// ==============================================

// Global State Management
const AppState = {
    currentUser: null,
    currentScreen: null,
    customers: [],
    packages: [],
    addons: [],
    selectedCustomer: null,
};

// ==============================================
// NAVIGATION (MULTI-PAGE)
// ==============================================

function navigateTo(page) {
    window.location.href = page;
}

// ==============================================
// TOAST NOTIFICATIONS
// ==============================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) return;

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
    if (!modal) return;

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-subtitle').textContent = subtitle;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('success-modal');
    if (!modal) return;

    modal.classList.remove('active');
    navigateTo('../index.html');
}

// ==============================================
// FORM HANDLERS (LOGIN / SIGNUP)
// ==============================================

document.addEventListener('submit', async (e) => {

    // ------------------------------
    // LOGIN FORM
    // ------------------------------
    if (e.target.id === 'login-form') {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            // TODO: API CALL
            // POST /auth/login
            const result = await API.login(email, password);

            if (!result.success) throw new Error(result.error);

            AppState.currentUser = result.user;
            showToast('Login successful!', 'success');

            navigateTo('./pages/dashboard.html');

        } catch (error) {
            showToast(error.message || 'Login failed', 'error');
        }
    }

    // ------------------------------
    // SIGNUP FORM
    // ------------------------------
    if (e.target.id === 'signup-form') {
        e.preventDefault();

        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;

        if (!name || !email || !password || !confirm) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }

        try {
            // TODO: API CALL
            // POST /auth/signup
            const result = await API.signup(name, email, password);

            if (!result.success) throw new Error(result.error);

            showSuccessModal(
                'Account created successfully!',
                'Go back to sign in page'
            );

        } catch (error) {
            showToast(error.message || 'Signup failed', 'error');
        }
    }
});

// ==============================================
// DASHBOARD DATA
// ==============================================

async function loadDashboardData() {
    try {
        // TODO: API CALL
        // GET /dashboard/stats
        const stats = await API.getDashboardStats();
        console.log('Dashboard stats:', stats);
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

function viewCustomerDetails(customerId) {
  // OPTIONAL: store selected customer
  AppState.selectedCustomer = customerId;

  // Switch views
  document.getElementById("customers-list")?.classList.add("hidden");
  document.getElementById("customer-details")?.classList.remove("hidden");

  console.log("Viewing customer:", customerId);
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

/*************************************************
 * VIEW SWITCHING
 *************************************************/
function openCustomerDetails() {
  document.getElementById("customers-list").classList.add("hidden");
  document.getElementById("customer-details").classList.remove("hidden");
}

function backToCustomers() {
  document.getElementById("customer-details").classList.add("hidden");
  document.getElementById("customers-list").classList.remove("hidden");
}

/*************************************************
 * MODAL HELPERS
 *************************************************/
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}


/*************************************************
 * BOOKING FLOW (BOOKING MODALS ONLY)
 *************************************************/
const bookingState = {
  customer: {},
  package: {},
  addons: [],
  discount: 0
};

function openBooking() {
  openBookingModal("modal-bc");
}

function openPackageModal() {
  closeBookingModal("modal-bc");
  openBookingModal("modal-bp");
}

function openSummaryModal() {
  closeBookingModal("modal-bp");
  openBookingModal("modal-bs");
}

function confirmBooking() {
  console.log("Booking data:", bookingState);
  closeBookingModal("modal-bs");
  alert("Booking confirmed!");
}

/*************************************************
 * HISTORY TOGGLE
 *************************************************/
function toggleHistory() {
  document.getElementById("customerHistory").classList.toggle("hidden");
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
// -------------------------------
// SHARED UI / MODAL LOGIC
// -------------------------------
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal() {
    const modals = document.querySelectorAll('.modal-backdrop');
    modals.forEach(modal => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
}

// Close on backdrop click
window.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
    }
});

// Close on ESC
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

document.addEventListener('submit', function (e) {
    if (e.target.matches('#createPackageModal form')) {
        e.preventDefault();
        handleCreatePackage(e.target);
    }

    if (e.target.matches('#editPackageModal form')) {
        e.preventDefault();
        handleEditPackage(e.target);
    }
});

document.addEventListener('submit', function (e) {

    if (e.target.matches('#createAddonModal form')) {
        e.preventDefault();
        handleCreateAddon(e.target);
    }

    if (e.target.matches('#editAddonModal form')) {
        e.preventDefault();
        handleEditAddon(e.target);
    }
});



// -------------------------------
// CREATE / EDIT PACKAGES
// -------------------------------

async function createNewPackage() {
    openModal('createPackageModal');
    showToast('Create new package functionality', 'info');
}

async function editPackage(packageId) {
    try {
        const pkg = await API.getPackage(packageId);
        if (!pkg) throw new Error('Package not found');

        // Fill basic fields
        document.getElementById('edit-package-name').value = pkg.name;
        document.getElementById('edit-package-price').value = pkg.price;

        // Inclusions container
        const container = document.getElementById('edit-package-inclusions');
        container.innerHTML = '';

        // Populate inclusions (SCROLLBAR + TRASH ICON)
        pkg.inclusions.forEach(text => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2';

            row.innerHTML = `
                <input type="text"
                       value="${text}"
                       class="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300
                              focus:outline-none focus:ring-2 focus:ring-teal-600">
                <button type="button"
                        onclick="this.closest('.flex').remove()"
                        class="text-gray-400 hover:text-red-500">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"
                              clip-rule="evenodd"/>
                    </svg>
                </button>
            `;

            container.appendChild(row);
        });

        // Open modal LAST
        openModal('editPackageModal');

    } catch (error) {
        console.error(error);
        alert('Failed to load package');
    }
}

function handleCreatePackage(form) {
    const data = new FormData(form);
    console.log('Create package:', Object.fromEntries(data));

    HeigenStudio.showNotification(
        'Package Created',
        'New package has been added successfully',
        'success'
    );

    closeModal();
}

function handleEditPackage(form) {
    const data = new FormData(form);
    console.log('Edit package:', Object.fromEntries(data));

    HeigenStudio.showNotification(
        'Package Updated',
        'Package details updated successfully',
        'success'
    );

    closeModal();
}

// -------------------------------
// CREATE / EDIT ADDONS
// -------------------------------

async function createNewAddon() {
     openModal('createAddonModal');
    showToast('Create new addon functionality', 'info');
}
async function editAddon(addonId) {
    try {
        const { addons } = await API.getAddons();
        const addon = addons.find(a => a.id === addonId);

        if (!addon) throw new Error('Addon not found');

        document.getElementById('edit-addon-name').value = addon.name;
        document.getElementById('edit-addon-price').value = addon.price;
        document.getElementById('edit-addon-description').value = addon.description || '';

        openModal('editAddonModal');

    } catch (error) {
        console.error(error);
        showToast('Failed to load addon', 'error');
    }
}



function handleCreateAddon(form) {
    const data = Object.fromEntries(new FormData(form));
    console.log('Create addon:', data);

    showToast('Addon created successfully', 'success');
    closeModal();
}

function handleEditAddon(form) {
    const data = Object.fromEntries(new FormData(form));
    console.log('Edit addon:', data);

    showToast('Addon updated successfully', 'success');
    closeModal();
}

function handleDeleteAddon() {
    showToast('Addon deleted', 'success');
    closeModal();
}

// ==============================================
// LOGOUT
// ==============================================

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;

    // TODO: API CALL (optional)
    // POST /auth/logout

    AppState.currentUser = null;
    AppState.customers = [];
    AppState.packages = [];
    AppState.addons = [];

    navigateTo('../index.html');
}

// ==============================================
// PAGE INITIALIZATION (AUTO LOAD DATA)
// ==============================================

document.addEventListener('DOMContentLoaded', () => {

    if (document.getElementById('dashboard-screen')) {
        loadDashboardData();
    }

    if (document.getElementById('customers-screen')) {
        loadCustomersData();
    }

    if (document.getElementById('packages-screen')) {
        loadPackagesData();
    }
});
