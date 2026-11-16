const API_BASE = "http://127.0.0.1:8000/api/v1";

let redirectAfterLogin = null;

// --- УПРАВЛІННЯ ТОКЕНАМИ ТА СТАНОМ ---
function getAccessToken() {
  return localStorage.getItem("access_token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

function setTokens(access, refresh, username) {
  localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
  if (username) localStorage.setItem("username", username);
  updateNavbar();
}

function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("username");
  updateNavbar();
}

function isAuthenticated() {
  return Boolean(getAccessToken());
}

function updateNavbar() {
  const guestZone = document.getElementById("guest-zone");
  const userZone = document.getElementById("user-zone");
  const usernameVal = document.getElementById("username-val");

  if (isAuthenticated()) {
    guestZone.style.display = "none";
    userZone.style.display = "flex";
    usernameVal.innerText = localStorage.getItem("username") || "Користувач";
  } else {
    guestZone.style.display = "flex";
    userZone.style.display = "none";
  }
}

// --- НАВІГАЦІЯ ТА РЕДІРЕКТИ ---
function navigateTo(pageId) {
  showAlert("");

  if (isAuthenticated() && (pageId === "login" || pageId === "register")) {
    navigateTo("catalog");
    return;
  }

  if (!isAuthenticated() && pageId === "admin-panel") {
    redirectAfterLogin = "admin-panel";
    navigateTo("login");
    showAlert("Для доступу до цієї сторінки необхідно увійти в акаунт.", "error");
    return;
  }

  document.querySelectorAll(".page-view").forEach(el => el.style.display = "none");
  const target = document.getElementById(`view-${pageId}`);
  if (target) {
    target.style.display = "block";
  }

  if (pageId === "catalog") {
    loadCatalog();
  }
}

function showAlert(message, type = "error") {
  const alertEl = document.getElementById("alert-box");
  if (!message) {
    alertEl.style.display = "none";
    return;
  }
  alertEl.className = `alert alert-${type}`;
  alertEl.innerText = message;
  alertEl.style.display = "block";
}

// --- ЗАХИЩЕНИЙ FETCH ІЗ АВТОМАТИЧНИМ REFRESH ТОКЕНА ---
async function authenticatedFetch(url, options = {}) {
  let token = getAccessToken();

  options.headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`
  };

  let response = await fetch(url, options);

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      options.headers["Authorization"] = `Bearer ${getAccessToken()}`;
      response = await fetch(url, options);
    } else {
      logout();
      navigateTo("login");
      showAlert("Сесія закінчилася. Будь ласка, увійдіть знову.", "error");
      return response;
    }
  }

  return response;
}

async function tryRefreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("access_token", data.access);
      return true;
    }
  } catch (err) {
    console.error("Refresh token error:", err);
  }
  return false;
}

// --- ОБРОБНИКИ ПОДІЙ (AUTH & CRUD) ---

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const firstName = document.getElementById("reg-firstname").value.trim();
  const lastName = document.getElementById("reg-lastname").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const passwordConfirm = document.getElementById("reg-password-confirm").value;

  if (password !== passwordConfirm) {
    showAlert("Паролі не збігаються!", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        password_confirmation: passwordConfirm
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const errors = Object.entries(data).map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`).join(" | ");
      showAlert(errors || "Помилка при реєстрації.", "error");
      return;
    }

    showAlert("Реєстрація успішна! Увійдіть зі своїми даними.", "success");
    navigateTo("login");
  } catch (err) {
    showAlert(`Помилка мережі: ${err.message}`, "error");
  }
}


async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.detail || "Невірний логін або пароль.", "error");
      return;
    }

    setTokens(data.access, data.refresh, username);

    const dest = redirectAfterLogin || "catalog";
    redirectAfterLogin = null;
    navigateTo(dest);
  } catch (err) {
    showAlert(`Помилка мережі: ${err.message}`, "error");
  }
}

function logout() {
  clearAuth();
  navigateTo("catalog");
  showAlert("Ви вийшли з акаунта.", "success");
}

async function loadCatalog() {
  const statusEl = document.getElementById("catalog-status");
  const gridEl = document.getElementById("products-grid");
  statusEl.style.display = "block";
  statusEl.innerText = "Завантаження товарів...";
  gridEl.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    statusEl.style.display = "none";
    const items = data.items || data;

    if (!items || items.length === 0) {
      statusEl.style.display = "block";
      statusEl.innerText = "Товари відсутні в базі.";
      return;
    }

    gridEl.innerHTML = items.map(item => `
      <div class="card">
        <h3>${item.name}</h3>
        <p>Бренд: <strong>${item.brand || '—'}</strong></p>
        <p style="color: #c94a69; font-weight: bold;">${item.price} грн</p>
      </div>
    `).join("");
  } catch (err) {
    statusEl.style.display = "block";
    statusEl.innerText = `Не вдалося отримати каталог: ${err.message}`;
  }
}

async function handleCreateProduct(event) {
  event.preventDefault();

  const payload = {
    sku: document.getElementById("p-sku").value.trim(),
    name: document.getElementById("p-name").value.trim(),
    description: document.getElementById("p-desc").value.trim(),
    price: parseFloat(document.getElementById("p-price").value),
    brand_id: parseInt(document.getElementById("p-brand").value),
    category_id: parseInt(document.getElementById("p-category").value)
  };

  try {
    const res = await authenticatedFetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error?.message || (data.detail ? data.detail : JSON.stringify(data));
      showAlert(`Не вдалося створити товар: ${msg}`, "error");
      return;
    }

    showAlert("Товар успішно створено!", "success");
    document.getElementById("create-product-form").reset();
    setTimeout(() => navigateTo("catalog"), 1000);
  } catch (err) {
    showAlert(`Помилка: ${err.message}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavbar();
  navigateTo("catalog");
});
