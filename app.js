// SmartStore — Main App JavaScript (app.js)

const API = 'api.php';

// ---- Global State ----
const App = {
  user:           null,
  products:       [],
  adminProducts:  [], 
  categories:     [],
  cart:           [],
  orders:         [],
  aiHistory:      [],
  aiOpen:         false,
  selectedCat:    'All',
  chatKey:        null,
  chatMerchantId: null,
};

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  await loadCategories();
  await loadProducts();
  renderCart();
  if (App.user) {
    loadOrders();
    loadChat();
  }
  bindNavSearch();
});


// ============================================================
// API HELPER
// ============================================================

async function api(action, data = {}) {
  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, ...data }),
    });
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return { error: 'Network error' };
  }
}

async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  try {
    const res = await fetch(`${API}?${qs}`);
    return await res.json();
  } catch (e) {
    return { error: 'Network error' };
  }
}


// ============================================================
// SESSION / AUTH
// ============================================================

async function checkSession() {
  const r = await api('me');
  if (r.user) setUser(r.user);
}

function setUser(user) {
  App.user = user;
  document.getElementById('nav-auth').classList.add('hidden');

  const navUser = document.getElementById('nav-user');
  navUser.classList.remove('hidden');
  navUser.style.display = 'flex';

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) navAvatar.textContent = initials;

  const avatarBtn  = document.getElementById('nav-avatar-btn');
  const initialsEl = document.getElementById('nav-avatar-initials');
  if (initialsEl) initialsEl.textContent = initials;
  if (avatarBtn)  avatarBtn.title = user.name;

  const pdName     = document.getElementById('pd-name');
  const pdEmail    = document.getElementById('pd-email');
  const pdAvatarLg = document.getElementById('pd-avatar-lg');
  if (pdName)     pdName.textContent     = user.name;
  if (pdEmail)    pdEmail.textContent    = user.email || '';
  if (pdAvatarLg) pdAvatarLg.textContent = initials;

  if (user.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  // Restore saved account setup for ALL users
  restoreSetupUI();
  App.cart = loadCart(); 
  renderCart();          
}

function clearUser() {
  App.user = null;
  document.getElementById('nav-auth').classList.remove('hidden');
  const navUser = document.getElementById('nav-user');
  navUser.classList.add('hidden');
  navUser.style.display = 'none';
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}


// ============================================================
// AUTH MODAL
// ============================================================

let authMode = 'login';
let selectedRole = 'customer'; 

function selectRole(role) {
  selectedRole = role;
  const customerBtn = document.getElementById('role-customer');
  const merchantBtn = document.getElementById('role-merchant');
  if (role === 'customer') {
    customerBtn.style.background  = '#E8401C';
    customerBtn.style.color       = '#fff';
    customerBtn.style.borderColor = '#E8401C';
    merchantBtn.style.background  = 'transparent';
    merchantBtn.style.color       = '#6b6b6b';
    merchantBtn.style.borderColor = '#e8e6e2';
  } else {
    merchantBtn.style.background  = '#E8401C';
    merchantBtn.style.color       = '#fff';
    merchantBtn.style.borderColor = '#E8401C';
    customerBtn.style.background  = 'transparent';
    customerBtn.style.color       = '#6b6b6b';
    customerBtn.style.borderColor = '#e8e6e2';
  }
}

function showAuth(mode = 'login') {
  authMode = mode;
  document.getElementById('auth-overlay').classList.add('active');
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-name-group').classList.toggle('hidden', mode !== 'register');
  document.getElementById('auth-name-group').style.display = mode === 'register' ? 'block' : 'none'; 
  document.getElementById('auth-modal-title').textContent = mode === 'login' ? 'Welcome back'          : 'Create account';
  document.getElementById('auth-modal-sub').textContent   = mode === 'login' ? 'Sign in to your account' : 'Join SmartStore today';
  document.getElementById('auth-submit-btn').textContent  = mode === 'login' ? 'Login'                 : 'Sign Up';
  document.getElementById('auth-toggle-text').textContent = mode === 'login' ? "Don't have an account?" : 'Already have an account?';
  document.getElementById('auth-toggle-link').textContent = mode === 'login' ? ' Sign Up'              : ' Login';
  document.getElementById('auth-email').focus();
  document.getElementById('auth-confirm-group').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('password-strength').style.display  = 'none';
  selectedRole = 'customer';
  selectRole('customer');
}

function closeAuth()       { document.getElementById('auth-overlay').classList.remove('active'); }
function toggleAuthMode()  { showAuth(authMode === 'login' ? 'register' : 'login'); }

function checkPasswordStrength(val) {
  const bar        = document.getElementById('strength-bar');
  const text       = document.getElementById('strength-text');
  const strengthEl = document.getElementById('password-strength');

  if (authMode !== 'register') return;
  strengthEl.style.display = val.length ? 'block' : 'none';

  let score = 0;
  if (val.length >= 8)           score++;
  if (/[A-Z]/.test(val))         score++;
  if (/[0-9]/.test(val))         score++;
  if (/[^A-Za-z0-9]/.test(val))  score++;

  const levels = [
    { label: 'Too short',  color: '#E24B4A', width: '25%'  },
    { label: 'Weak',       color: '#E24B4A', width: '25%'  },
    { label: 'Fair',       color: '#EF9F27', width: '50%'  },
    { label: 'Good',       color: '#EF9F27', width: '75%'  },
    { label: 'Strong',     color: '#1d9e75', width: '100%' },
  ];

  const level          = val.length < 8 ? 0 : score;
  bar.style.width      = levels[level].width;
  bar.style.background = levels[level].color;
  text.textContent     = levels[level].label;
  text.style.color     = levels[level].color;
}

async function authSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-password').value;
  const name  = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !pass)                          { errEl.textContent = 'Please fill in all fields.'; return; }
  if (authMode === 'register' && !name)         { errEl.textContent = 'Please enter your name.';   return; }

  if (authMode === 'register') {
    if (pass.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
    if (!/[A-Z]/.test(pass)) { errEl.textContent = 'Password must contain at least one uppercase letter.'; return; }
    if (!/[0-9]/.test(pass)) { errEl.textContent = 'Password must contain at least one number.'; return; }
    const confirm = document.getElementById('auth-confirm').value;
    if (pass !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }
  }

  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true; btn.textContent = '...';

  const r = await api(authMode === 'login' ? 'login' : 'register', { email, password: pass, name, role: selectedRole });
  btn.disabled = false; btn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';

  if (r.error) { errEl.textContent = r.error; return; }
  setUser(r.user);
  closeAuth();
  toast('Welcome, ' + r.user.name.split(' ')[0] + '! 👋');
  loadOrders();
  loadChat();
}

async function logout() {
  await api('logout');
  clearUser();
  App.cart = [];
  renderCart();
  showPage('home');
  toast('Logged out successfully');
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const wrap     = document.getElementById('profile-avatar-wrap');
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown && wrap && !wrap.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});


// ============================================================
// NAVIGATION
// ============================================================

function showPage(pg) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pg + '-page').classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-page="${pg}"]`);
  if (link) link.classList.add('active');

  if (pg === 'orders') { if (App.user) loadOrders(); else { showAuth('login'); return; } }
  if (pg === 'chat')   { if (App.user) loadChat();   else { showAuth('login'); return; } }
  if (pg === 'admin')  { if (App.user && App.user.role === 'admin') loadAdmin(); else { showPage('home'); return; } }
}


// ============================================================
// PRODUCTS
// ============================================================

async function loadCategories() {
  const r = await apiGet('get_categories');
  App.categories = r.categories || [];
  renderCategories();
}

function renderCategories() {
  const el   = document.getElementById('cat-scroll');
  const cats = ['All', ...App.categories.map(c => c.name)];
  el.innerHTML = cats.map(c =>
    `<div class="cat-chip ${c === App.selectedCat ? 'active' : ''}" onclick="selectCat('${c}',this)">${c}</div>`
  ).join('');
}

async function loadProducts() {
  const params = {};
  if (App.selectedCat !== 'All') params.category = App.selectedCat;
  const q = document.getElementById('hero-search')?.value?.trim();
  if (q) params.search = q;
  const r = await apiGet('get_products', params);
  App.products = r.products || [];
  renderProducts();
}

function selectCat(cat, el) {
  App.selectedCat = cat;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  loadProducts();
}

function bindNavSearch() {
  const inp = document.getElementById('hero-search');
  if (inp) inp.addEventListener('input', debounce(loadProducts, 300));
}

function renderProducts() {
  const el = document.getElementById('product-grid');
  document.getElementById('products-label').textContent = App.selectedCat === 'All' ? 'All Products' : App.selectedCat;
  document.getElementById('product-count').textContent  = App.products.length + ' items';

  if (!App.products.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="esc-icon">🔍</div>
      <h3>No products found</h3>
      <p>Try a different search or category</p>
    </div>`;
    return;
  }
  el.innerHTML = App.products.map(p => `
    <div class="product-card">
      <div class="product-img">${productImgHTML(p)}</div>
      <div class="product-body">
        <div class="product-cat">${p.category || ''}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-desc">${esc(p.description || '')}</div>
        <div class="product-footer">
          <div class="product-price">₱${parseFloat(p.price).toFixed(2)}</div>
          <button class="add-btn" onclick="addToCart(${p.id})" title="Add to cart">+</button>
        </div>
        <button class="chat-seller-btn" onclick="chatWithSeller(${p.id}, ${p.merchant_id}, '${esc(p.name)}')">
          💬 Chat with Seller
        </button>
      </div>
    </div>`).join('');
}

function productImgHTML(p) {
  if (p.image && p.image.length <= 4)                    return p.image; // emoji
  if (p.image && p.image !== 'placeholder.png')          return `<img src="uploads/products/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`;
  return '🍽';
}


// ============================================================
// CART
// ============================================================

function addToCart(id) {
  if (!App.user) { showAuth('login'); toast('Please login to add items'); return; }
  const p  = App.products.find(p => p.id == id);
  if (!p) return;
  const ex = App.cart.find(c => c.id == id);
  if (ex) ex.qty++;
  else App.cart.push({ ...p, qty: 1 });
  saveCart();
  renderCart();
  toast(p.name + ' added to cart 🛒');
}

function updateQty(id, delta) {
  const item = App.cart.find(c => c.id == id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) App.cart = App.cart.filter(c => c.id != id);
  saveCart();
  renderCart();
}

function renderCart() {
  const total   = App.cart.reduce((s, c) => s + parseFloat(c.price) * c.qty, 0);
  const cnt     = App.cart.reduce((s, c) => s + c.qty, 0);
  const countEl = document.getElementById('cart-count');
  countEl.textContent    = cnt;
  countEl.style.display  = cnt > 0 ? 'flex' : 'none';
  document.getElementById('cart-total').textContent = '₱' + total.toFixed(2);

  const el = document.getElementById('cart-items');
  if (!App.cart.length) {
    el.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Your cart is empty</p></div>`;
    return;
  }
  el.innerHTML = App.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${productImgHTML(item)}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-price">₱${(parseFloat(item.price) * item.qty).toFixed(2)}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty(${item.id},-1)">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateQty(${item.id},1)">+</button>
      </div>
    </div>`).join('');
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('visible');
}

async function placeOrder() {
  if (!App.user)        { showAuth('login'); return; }
  if (!App.cart.length) { toast('Your cart is empty'); return; }
  showConfirmOrder();
}

function showConfirmOrder() {
  const saved = loadSetupData();

  const itemsEl = document.getElementById('confirm-items');
  itemsEl.innerHTML = App.cart.map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:13px;">${esc(item.name)} <span style="color:#6b6b6b;">x${item.qty}</span></span>
      <span style="font-size:13px;font-weight:600;color:#E8401C;">₱${(parseFloat(item.price) * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  const total = App.cart.reduce((s, c) => s + parseFloat(c.price) * c.qty, 0);
  document.getElementById('confirm-total').textContent = '₱' + total.toFixed(2);


  const address = saved.address
    ? [saved.address.street, saved.address.city, saved.address.province].filter(Boolean).join(', ')
    : null;
  const payment = saved.payment
    ? (saved.payment.number ? `${saved.payment.type} • •••• ${saved.payment.number.replace(/\s/g,'').slice(-4)}` : saved.payment.type)
    : null;
  const contact = saved.contact ? saved.contact.phone : null;

  document.getElementById('confirm-address').textContent = address || '—';
  document.getElementById('confirm-payment').textContent = payment || '—';
  document.getElementById('confirm-contact').textContent = contact || '—';

  const missing = [];
  if (!address) missing.push('delivery address');
  if (!payment) missing.push('payment method');
  if (!contact) missing.push('contact info');

  const warningEl  = document.getElementById('confirm-warning');
  const warningBtn = document.getElementById('confirm-order-btn');

  if (missing.length) {
    document.getElementById('confirm-warning-text').textContent = missing.join(', ');
    warningEl.style.display  = 'block';
    warningBtn.disabled      = true;
    warningBtn.style.opacity = '0.5';
  } else {
    warningEl.style.display  = 'none';
    warningBtn.disabled      = false;
    warningBtn.style.opacity = '1';
  }

  document.getElementById('confirm-order-overlay').classList.add('active');
}

function closeConfirmOrder() {
  document.getElementById('confirm-order-overlay').classList.remove('active');
}

function editFromConfirm(type) {
  closeConfirmOrder();
  openSetupModal(type);

  const originalSave = window._originalSaveSetup;
  const saveBtn = document.getElementById('setup-save-btn');
  
  saveBtn.onclick = function() {
    saveSetupModal();
    setTimeout(() => {
      showConfirmOrder();
    }, 300);
  };
}

async function confirmPlaceOrder() {
  const btn = document.getElementById('confirm-order-btn');
  btn.disabled = true;
  btn.textContent = 'Placing...';

  const items = App.cart.map(c => ({ id: c.id, price: c.price, qty: c.qty }));
  const r = await api('place_order', { items });

  btn.disabled = false;
  btn.textContent = 'Place Order 🎉';

  if (r.error) { toast('Error: ' + r.error); return; }

  closeConfirmOrder();
  toast('Order placed! 🎉 #' + r.order_id);
  App.cart = [];
  saveCart();
  renderCart();
  toggleCart();
  showPage('orders');
}


// ============================================================
// ORDERS
// ============================================================

const STATUS_STEPS  = ['pending', 'preparing', 'completed'];
const STATUS_LABELS = { pending: 'Pending', preparing: 'Preparing', completed: 'Completed', cancelled: 'Cancelled' };
const STATUS_ICONS  = { pending: '⏳', preparing: '👨‍🍳', completed: '✅', cancelled: '✖' };

async function loadOrders() {
  const r = await api('get_orders');
  App.orders = r.orders || [];
  renderOrders();
}

function renderOrders() {
  const el = document.getElementById('orders-list');
  if (!App.orders.length) {
    el.innerHTML = `<div class="empty-state"><div class="esc-icon">📋</div><h3>No orders yet</h3><p>Your orders will appear here after you place them.</p></div>`;
    return;
  }
  el.innerHTML = App.orders.map(o => {
    const si = STATUS_STEPS.indexOf(o.status);
    const dt = new Date(o.created_at).toLocaleString();
    return `<div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">Order #${o.id}</div>
          <div class="order-meta">${dt}</div>
        </div>
        <div style="text-align:right">
          <span class="badge badge-${o.status === 'completed' ? 'success' : o.status === 'preparing' ? 'warning' : 'gray'}">
            ${STATUS_ICONS[o.status] || ''} ${STATUS_LABELS[o.status] || o.status}
          </span>
          <div class="order-total" style="margin-top:5px">₱${parseFloat(o.total).toFixed(2)}</div>
        </div>
      </div>
      <div class="order-items-summary">${esc(o.items_summary || '')}</div>
      ${o.status !== 'cancelled' ? `
      <div class="order-progress">
        ${STATUS_STEPS.map((s, idx) => `
          <div class="progress-step">
            <div class="progress-dot ${idx < si ? 'done' : idx === si ? 'active' : ''}">
              ${idx < si ? '✓' : STATUS_ICONS[s]}
            </div>
            <div class="progress-label ${idx <= si ? 'done' : ''}">${STATUS_LABELS[s]}</div>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('');
}


// ============================================================
// SUPPORT CHAT
// ============================================================

async function loadChat() {
  if (!App.user) return;
  const r = await api('get_chat');
  renderChatMessages(r.messages || [], 'chat-messages');

  setInterval(async () => {
    const r = await api('get_chat');
    renderChatMessages(r.messages || [], 'chat-messages');
  }, 5000);

  setInterval(async () => {
    await api('check_pending_replies');
  }, 2 * 60 * 1000);

  api('check_pending_replies');
}

function renderChatMessages(messages, containerId) {
  const el = document.getElementById(containerId);
  if (!messages.length) {
    el.innerHTML = `<div class="msg msg-store">Hi! 👋 Welcome to SmartStore. How can we help you today?<div class="msg-meta">Support Team</div></div>`;
    return;
  }
  el.innerHTML = messages.map(m => {
    const side = m.sender === 'customer' ? 'msg-store' :
                 m.sender === 'ai'       ? 'msg-ai'    : 'msg-customer';
    return `
      <div class="msg ${side}">
        ${esc(m.message)}
        <div class="msg-meta">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
  if (!App.user) { showAuth('login'); return; }
  const inp  = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  await api('send_chat', { message: text, merchant_id: App.chatMerchantId || null });
  loadChat();
}

function chatWithSeller(productId, merchantId, productName) {
  if (!App.user) { showAuth('login'); toast('Please login to chat with seller'); return; }
  App.chatMerchantId = merchantId;
  showPage('chat');
  const inp = document.getElementById('chat-input');
  inp.value = `Hi! I have a question about "${productName}"`;
  inp.focus();
  toast('Chatting with seller about ' + productName);
}

// ============================================================
// ADMIN
// ============================================================

function loadAdmin() {
  loadAdminProducts();
  loadAdminOrders();
  loadAdminChats();
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-' + tab).classList.add('active');
}

// ---- Admin Products ----
async function loadAdminProducts() {
  const r = await apiGet('get_products', { admin_view: 1 });
  App.adminProducts = r.products || [];
  renderAdminProducts(App.adminProducts);
}

function renderAdminProducts(prods) {
  const tbody = document.getElementById('admin-products-body');
  tbody.innerHTML = prods.map(p => `
    <tr>
      <td style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">${productImgHTML(p)}</span>
        <span>${esc(p.name)}</span>
      </td>
      <td><span class="badge badge-gray">${esc(p.category || '')}</span></td>
      <td style="font-weight:600;color:var(--primary)">₱${parseFloat(p.price).toFixed(2)}</td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="openEditProduct(${p.id})" style="margin-right:6px">Edit</button>
        <button class="btn btn-danger  btn-xs" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>`).join('');
}

let editingProductId = null;

function openAddProduct() {
  editingProductId = null;
  document.getElementById('admin-form-title').textContent = 'Add New Product';
  document.getElementById('pf-name').value  = '';
  document.getElementById('pf-desc').value  = '';
  document.getElementById('pf-price').value = '';
  document.getElementById('pf-image').value = '';
  document.getElementById('pf-img-preview').textContent = '🍽';
  document.getElementById('product-form-modal').classList.add('active');
}

function openEditProduct(id) {
  const p = App.adminProducts.find(p => p.id == id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('admin-form-title').textContent = 'Edit Product';
  document.getElementById('pf-name').value  = p.name;
  document.getElementById('pf-desc').value  = p.description || '';
  document.getElementById('pf-price').value = p.price;
  document.getElementById('pf-image').value = p.image || '';
  const prev = document.getElementById('pf-img-preview');
  prev.innerHTML = productImgHTML(p) || '🍽';
  const catSel = document.getElementById('pf-cat');
  for (let i = 0; i < catSel.options.length; i++) {
    if (catSel.options[i].text === p.category) { catSel.selectedIndex = i; break; }
  }
  document.getElementById('product-form-modal').classList.add('active');
}

function closeProductModal() { document.getElementById('product-form-modal').classList.remove('active'); }

async function saveProduct() {
  const name   = document.getElementById('pf-name').value.trim();
  const desc   = document.getElementById('pf-desc').value.trim();
  const price  = parseFloat(document.getElementById('pf-price').value);
  const image  = document.getElementById('pf-image').value.trim() || 'placeholder.png';
  const catSel = document.getElementById('pf-cat');
  const catId  = catSel.value;
  if (!name || !price || !catId) { toast('Please fill in all required fields'); return; }

  const action  = editingProductId ? 'edit_product' : 'add_product';
  const payload = { name, description: desc, price, image, category_id: catId };
  if (editingProductId) payload.id = editingProductId;

  const r = await api(action, payload);
  if (r.error) { toast('Error: ' + r.error); return; }
  toast(editingProductId ? 'Product updated!' : 'Product added!');
  closeProductModal();
  loadAdminProducts();
  loadProducts();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const r = await api('delete_product', { id });
  if (r.error) { toast('Error: ' + r.error); return; }
  toast('Product deleted');
  loadAdminProducts();
  loadProducts();
}

// ---- Image Upload ----
async function handleImageUpload(file) {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('action', 'upload_image');
  try {
    const res = await fetch(API, { method: 'POST', body: fd });
    const r   = await res.json();
    if (r.error) { toast('Upload error: ' + r.error); return; }
    document.getElementById('pf-image').value = r.filename;
    const prev = document.getElementById('pf-img-preview');
    prev.innerHTML = `<img src="${r.url}" style="width:100%;height:100%;object-fit:cover">`;
    toast('Image uploaded!');
  } catch (e) { toast('Upload failed'); }
}

// ---- Admin Orders ----
async function loadAdminOrders() {
  const r = await api('get_all_orders');
  renderAdminOrders(r.orders || []);
}

function renderAdminOrders(orders) {
  const tbody = document.getElementById('admin-orders-body');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:28px">No orders yet</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-weight:600">#${o.id}</td>
      <td>${esc(o.customer_name)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.items_summary || '')}</td>
      <td style="font-weight:600">₱${parseFloat(o.total).toFixed(2)}</td>
      <td><span class="badge badge-${o.status === 'completed' ? 'success' : o.status === 'preparing' ? 'warning' : 'gray'}">
        ${STATUS_LABELS[o.status] || o.status}</span></td>
      <td>
        <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
          ${['pending','preparing','completed','cancelled'].map(s =>
            `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('');
}

async function updateOrderStatus(id, status) {
  const r = await api('update_order', { id, status });
  if (r.error) { toast('Error: ' + r.error); return; }
  toast('Order #' + id + ' → ' + STATUS_LABELS[status]);
  loadAdminOrders();
}


// ============================================================
// ADMIN CHATS
// ============================================================

let adminSelectedUser = null;
let adminChatsData    = {};
let adminContactsListenerAttached = false;

async function loadAdminChats() {
  const r = await api('get_all_chats');
  if (r.error) {
    document.getElementById('admin-contacts').innerHTML =
      `<div style="padding:20px;color:red;font-size:13px;text-align:center">Error: ${r.error}</div>`;
    return;
  }
  renderAdminChatContacts(r.chats || {});
}

function renderAdminChatContacts(chats) {
  adminChatsData = chats;
  const el   = document.getElementById('admin-contacts');
  const keys = Object.keys(chats);

  if (!keys.length) {
    el.innerHTML = `
      <div class="chat-contacts-header">Customers</div>
      <div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">No customer chats yet</div>`;
    return;
  }

  el.innerHTML =
    `<div class="chat-contacts-header">Customers</div>` +
    keys.map(uid => {
      const chat    = chats[uid];
      const msgs    = chat.messages || [];
      const last    = msgs[msgs.length - 1];
      const preview = last
        ? esc(last.message.slice(0, 30)) + (last.message.length > 30 ? '…' : '')
        : 'No messages yet';
      const isActive = String(adminSelectedUser) === String(uid) ? 'active' : '';
      return `
        <div class="chat-contact ${isActive}" data-uid="${uid}">
          <div class="contact-avatar">${esc(chat.user_name[0].toUpperCase())}</div>
          <div style="overflow:hidden;flex:1;min-width:0">
            <div class="contact-name">${esc(chat.user_name)}</div>
            <div class="contact-preview">${preview}</div>
          </div>
        </div>`;
    }).join('');

  if (!adminContactsListenerAttached) {
    el.addEventListener('click', e => {
      const contact = e.target.closest('.chat-contact');
      if (contact) selectAdminChat(contact.dataset.uid);
    });
    adminContactsListenerAttached = true;
  }
}

function selectAdminChat(userId) {
  adminSelectedUser = userId;
  const chat = adminChatsData[userId];
  if (!chat || !chat.user_name) { console.warn('Chat data missing for userId:', userId); return; }

  const name     = chat.user_name;
  const messages = chat.messages || [];

  document.querySelectorAll('.chat-contact').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.chat-contact[data-uid="${userId}"]`);
  if (active) active.classList.add('active');

  document.getElementById('admin-chat-name').textContent   = name;
  document.getElementById('admin-chat-avatar').textContent = name[0].toUpperCase();

  const msgEl = document.getElementById('admin-chat-messages');
  if (!messages.length) {
    msgEl.innerHTML = `
      <div class="cart-empty" style="padding:40px 0">
        <div class="cart-empty-icon">💬</div>
        <p>No messages yet</p>
      </div>`;
    return;
  }

  msgEl.innerHTML = messages.map(m => {
    const side = m.sender === 'store' ? 'msg-store' :
                 m.sender === 'ai'    ? 'msg-ai'    : 'msg-customer';
    return `
      <div class="msg ${side}">
        ${esc(m.message)}
        <div class="msg-meta">
          ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>`;
  }).join('');
  msgEl.scrollTop = msgEl.scrollHeight;
}

async function adminSendChat() {
  if (!adminSelectedUser) { toast('Select a conversation first'); return; }
  const inp  = document.getElementById('admin-chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  const r = await api('admin_reply', { user_id: adminSelectedUser, message: text });
  if (r.error) { toast('Error: ' + r.error); return; }
  toast('Reply sent ✓');
  await loadAdminChats();
  selectAdminChat(adminSelectedUser);
}


// ============================================================
// AI ASSISTANT
// ============================================================

function toggleAI() {
  App.aiOpen = !App.aiOpen;
  document.getElementById('ai-panel').classList.toggle('open', App.aiOpen);
  if (App.aiOpen && App.aiHistory.length === 0) {
    appendAIMessage('ai', "Hi! I'm your SmartStore AI assistant powered by Claude. I can help you find products, answer questions, and make recommendations! What are you looking for today? 😊");
    document.getElementById('ai-quick-btns').style.display = 'flex';
  }
}

function aiQuick(q) {
  document.getElementById('ai-input').value = q;
  sendAIMessage();
}

function appendAIMessage(role, text) {
  const el  = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'msg-store' : 'msg-ai');
  div.innerHTML = text.replace(/\n/g, '<br>') +
    `<div class="msg-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

async function sendAIMessage() {
  const inp  = document.getElementById('ai-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  document.getElementById('ai-quick-btns').style.display = 'none';

  appendAIMessage('user', esc(text));
  App.aiHistory.push({ role: 'user', content: text });

  const typingEl = appendAIMessage('ai', '<span class="ai-typing">Thinking...</span>');
  const r        = await api('ai_chat', { message: text, history: App.aiHistory });
  const reply    = r.reply || "Sorry, I'm having trouble. Please try again!";

  typingEl.innerHTML = reply.replace(/\n/g, '<br>') +
    `<div class="msg-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
  document.getElementById('ai-messages').scrollTop = 9999;
  App.aiHistory.push({ role: 'assistant', content: reply });
}


// ============================================================
// ACCOUNT SETUP — Address, Payment, Contact
// ============================================================

let currentSetupType = null;

function openSetupModal(type) {
  currentSetupType = type;

  // Hide all sub-forms
  document.getElementById('setup-form-address').style.display = 'none';
  document.getElementById('setup-form-payment').style.display = 'none';
  document.getElementById('setup-form-contact').style.display = 'none';

  const titles = {
    address: ['Delivery Address',    'Enter your delivery address'],
    payment: ['Payment Method',      'Add your preferred payment method'],
    contact: ['Contact Information', 'Enter your contact details'],
  };

  document.getElementById('setup-modal-title').textContent = titles[type][0];
  document.getElementById('setup-modal-sub').textContent   = titles[type][1];
  document.getElementById('setup-form-' + type).style.display = 'block';


  const saved = loadSetupData();

  if (type === 'address' && saved.address) {
    document.getElementById('setup-street').value   = saved.address.street   || '';
    document.getElementById('setup-city').value     = saved.address.city     || '';
    document.getElementById('setup-province').value = saved.address.province || '';
  }

  if (type === 'payment' && saved.payment) {
    document.getElementById('setup-pay-type').value   = saved.payment.type   || '';
    togglePayFields();
    document.getElementById('setup-pay-number').value = saved.payment.number || '';
  }

  if (type === 'contact' && saved.contact) {
    document.getElementById('setup-phone').value     = saved.contact.phone    || '';
    document.getElementById('setup-phone-alt').value = saved.contact.phoneAlt || '';
  }

  document.getElementById('setup-modal-overlay').classList.add('active');
}

function closeSetupModal() {
  document.getElementById('setup-modal-overlay').classList.remove('active');
  currentSetupType = null;
}

function togglePayFields() {
  const type        = document.getElementById('setup-pay-type').value;
  const group       = document.getElementById('setup-pay-number-group');
  const label       = document.getElementById('setup-pay-number-label');
  const needsNumber = ['GCash', 'Maya', 'Credit Card', 'Debit Card'].includes(type);
  group.style.display = needsNumber ? 'block' : 'none';
  label.textContent   = (type === 'GCash' || type === 'Maya') ? 'Mobile Number' : 'Card Number (last 4 digits)';
}

function saveSetupModal() {
  const saved = loadSetupData();

  if (currentSetupType === 'address') {
    const street   = document.getElementById('setup-street').value.trim();
    const city     = document.getElementById('setup-city').value.trim();
    const province = document.getElementById('setup-province').value.trim();
    if (!city) { toast('Please enter at least a city'); return; }
    saved.address = { street, city, province };
    const display = [street, city, province].filter(Boolean).join(', ');
    document.getElementById('pd-address-sub').textContent = display;
    document.getElementById('pd-address-sub').style.cssText = 'color:#aaa;font-style:normal';
  }

  if (currentSetupType === 'payment') {
    const type   = document.getElementById('setup-pay-type').value;
    const number = document.getElementById('setup-pay-number').value.trim();
    if (!type) { toast('Please select a payment type'); return; }
    if (['GCash', 'Maya', 'Credit Card', 'Debit Card'].includes(type) && !number) {
      toast('Please enter your number / card digits'); return;
    }
    saved.payment = { type, number };
    const last4   = number ? number.replace(/\s/g, '').slice(-4) : '';
    const display = last4 ? `${type} • •••• ${last4}` : type;
    document.getElementById('pd-payment-sub').textContent = display;
    document.getElementById('pd-payment-sub').style.cssText = 'color:#aaa;font-style:normal';
  }

  if (currentSetupType === 'contact') {
    const phone    = document.getElementById('setup-phone').value.trim();
    const phoneAlt = document.getElementById('setup-phone-alt').value.trim();
    if (!phone) { toast('Please enter a phone number'); return; }
    saved.contact = { phone, phoneAlt };
    document.getElementById('pd-contact-sub').textContent = phone;
    document.getElementById('pd-contact-sub').style.cssText = 'color:#aaa;font-style:normal';
  }

  saveSetupData(saved);
  closeSetupModal();
  toast('Saved successfully ✓');
}

function setupKey() {
  return 'smartstore_setup_' + (App.user ? App.user.id : 'guest');
}
function loadSetupData() {
  try { return JSON.parse(localStorage.getItem(setupKey()) || '{}'); } catch { return {}; }
}
function saveSetupData(data) {
  localStorage.setItem(setupKey(), JSON.stringify(data));
}

function cartKey() {
  return 'smartstore_cart_' + (App.user ? App.user.id : 'guest');
}
function saveCart() {
  localStorage.setItem(cartKey(), JSON.stringify(App.cart));
}
function loadCart() {
  try { return JSON.parse(localStorage.getItem(cartKey()) || '[]'); } catch { return []; }
}

function restoreSetupUI() {
  const saved = loadSetupData();

  if (saved.address) {
    const d = [saved.address.street, saved.address.city, saved.address.province].filter(Boolean).join(', ');
    document.getElementById('pd-address-sub').textContent = d;
    document.getElementById('pd-address-sub').style.cssText = 'color:#aaa;font-style:normal';
  }

  if (saved.payment) {
    const last4 = saved.payment.number ? saved.payment.number.replace(/\s/g, '').slice(-4) : '';
    const d     = last4 ? `${saved.payment.type} • •••• ${last4}` : saved.payment.type;
    document.getElementById('pd-payment-sub').textContent = d;
    document.getElementById('pd-payment-sub').style.cssText = 'color:#aaa;font-style:normal';
  }

  if (saved.contact) {
    document.getElementById('pd-contact-sub').textContent = saved.contact.phone;
    document.getElementById('pd-contact-sub').style.cssText = 'color:#aaa;font-style:normal';
  }
}


// ============================================================
// UTILITIES
// ============================================================

function toast(msg, duration = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('cart-sidebar').classList.contains('open'))         toggleCart();
    if (document.getElementById('auth-overlay').classList.contains('active'))       closeAuth();
    if (document.getElementById('ai-panel').classList.contains('open'))             toggleAI();
    if (document.getElementById('product-form-modal').classList.contains('active')) closeProductModal();
    if (document.getElementById('setup-modal-overlay').classList.contains('active')) closeSetupModal();
    if (document.getElementById('confirm-order-overlay').classList.contains('active')) closeConfirmOrder(); 
  }
});
