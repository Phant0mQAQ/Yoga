let token = "";
let locale = "en";
const API_BASE_URL = normalizeBaseUrl(window.YOMI_CONFIG?.apiBaseUrl ?? "");

const el = (id) => document.getElementById(id);

el("locale").addEventListener("change", async (event) => {
  locale = event.target.value;
  if (token) await runAction(loadDashboard);
});
el("loginBtn").addEventListener("click", login);
el("refreshBtn").addEventListener("click", () => runAction(loadDashboard));
el("demoBookingBtn").addEventListener("click", () => runAction(createDemoBooking));
el("loadMethodsBtn").addEventListener("click", () => runAction(loadPaymentMethods));
el("country").addEventListener("change", syncCurrencyForCountry);

async function login() {
  try {
    const response = await api("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: el("email").value.trim().toLowerCase(),
        password: el("password").value,
        role: "admin",
        locale
      }
    });
    token = response.token;
    el("loginPanel").hidden = true;
    el("summaryGrid").hidden = false;
    el("contentPanel").hidden = false;
    el("paymentPanel").hidden = false;
    el("auditPanel").hidden = false;
    await loadDashboard();
  } catch (error) {
    el("loginHint").textContent = error.message;
  }
}

async function loadDashboard() {
  if (!token) return;
  const [courses, bookings, memberCards, payments, availability, auditLogs] = await Promise.all([
    api(`/api/v1/admin/courses?locale=${locale}`),
    api(`/api/v1/bookings?locale=${locale}`),
    api("/api/v1/admin/member-cards"),
    api("/api/v1/admin/payments"),
    api(`/api/v1/availability?locale=${locale}`),
    api("/api/v1/admin/audit-logs")
  ]);

  el("courseCount").textContent = courses.length;
  el("bookingCount").textContent = bookings.length;
  el("memberCardCount").textContent = memberCards.length;
  el("paymentCount").textContent = payments.length;

  renderAvailability(availability);
  renderBookings(bookings);
  renderAudit(auditLogs);
  await loadPaymentMethods();
}

function renderAvailability(rows) {
  el("availabilityRows").innerHTML = rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.course?.title ?? item.courseId)}</td>
      <td>${escapeHtml(item.coach?.name ?? item.coachId)}</td>
      <td>${formatDate(item.startsAt)}</td>
      <td>${item.remainingCapacity}</td>
    </tr>
  `).join("");
}

function renderBookings(rows) {
  el("bookingRows").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.user?.name ?? item.userId)}</td>
      <td>${escapeHtml(item.course?.title ?? item.courseId)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>
        ${item.status === "confirmed" ? `<button class="secondary" data-checkin="${item.id}">Check in</button>` : ""}
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4">No bookings yet.</td></tr>`;

  document.querySelectorAll("[data-checkin]").forEach((button) => {
    button.addEventListener("click", () => {
      runAction(async () => {
        await api(`/api/v1/bookings/${button.dataset.checkin}/check-in`, {
          method: "POST",
          body: { method: "manual" }
        });
        await loadDashboard();
      });
    });
  });
}

function renderAudit(rows) {
  el("auditRows").innerHTML = rows.slice(-12).reverse().map((item) => `
    <tr>
      <td>${formatDate(item.createdAt)}</td>
      <td>${escapeHtml(item.actorRole)}</td>
      <td>${escapeHtml(item.action)}</td>
      <td>${escapeHtml(item.entityId)}</td>
    </tr>
  `).join("");
}

async function createDemoBooking() {
  const availability = await api(`/api/v1/availability?locale=${locale}`);
  const first = availability[0];
  if (!first) return;

  const adminToken = token;
  const studentLogin = await api("/api/v1/auth/login", {
    method: "POST",
    body: {
      email: "student@example.com",
      password: "Yomi@2026",
      role: "student",
      locale
    }
  });
  token = studentLogin.token;
  await api("/api/v1/bookings", {
    method: "POST",
    idempotencyKey: `demo-${Date.now()}`,
    body: {
      courseSessionId: first.id,
      paymentMode: "member_card"
    }
  });
  token = adminToken;
  await loadDashboard();
}

async function loadPaymentMethods() {
  const country = el("country").value;
  const currency = el("currency").value;
  const methods = await api(`/api/v1/payments/methods?country=${country}&currency=${currency}&locale=${locale}`);
  el("paymentMethods").innerHTML = methods.map((method) => `
    <div class="method">
      <strong>${escapeHtml(method.display?.[locale] ?? method.display?.en ?? method.code)}</strong>
      <span>${escapeHtml(method.code)} · ${escapeHtml(method.family)} · ${escapeHtml(method.flow)}</span>
    </div>
  `).join("");
}

function syncCurrencyForCountry() {
  if (el("country").value === "KR") el("currency").value = "KRW";
  if (el("country").value === "HK") el("currency").value = "HKD";
  if (el("country").value === "CN") el("currency").value = "CNY";
  if (el("country").value === "US") el("currency").value = "USD";
}

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Request failed");
  }
  return data;
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    el("loginHint").textContent = error.message;
    console.error(error);
  }
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function formatDate(value) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
