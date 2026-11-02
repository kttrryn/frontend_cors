const API_URL = "http://127.0.0.1:8000/api/v1/products";

async function fetchProducts() {
  const statusEl = document.getElementById("status");
  const gridEl = document.getElementById("products-grid");

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    statusEl.style.display = "none";
    const items = data.items || data;

    if (items.length === 0) {
      statusEl.style.display = "block";
      statusEl.innerText = "Товари відсутні. Додайте їх через API або Django Admin.";
      return;
    }

    gridEl.innerHTML = items.map(product => `
      <div class="card">
        <h3>${product.name}</h3>
        <p>Бренд: <strong>${product.brand || '—'}</strong></p>
        <p class="price">${product.price} грн</p>
      </div>
    `).join("");

  } catch (err) {
    statusEl.className = "error";
    statusEl.innerText = `Не вдалося завантажити товари: ${err.message}. Переконайтеся, що бекенд запущено на порті 8000.`;
  }
}

document.addEventListener("DOMContentLoaded", fetchProducts);
