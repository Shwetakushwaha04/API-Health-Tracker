if (!getToken()) {
  window.location.href = "/login.html";
}

const apiList = document.getElementById("apiList");
const totalApis = document.getElementById("totalApis");
const healthyApis = document.getElementById("healthyApis");
const downApis = document.getElementById("downApis");
const toast = document.getElementById("toast");

let toastTimer = null;

// Small message at the bottom of the page (replaces alert())
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

// Builds an element and sets its text safely.
// textContent never runs HTML, so API names cannot inject scripts.
function el(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "never";
}

// Get APIs from backend
async function loadAPIs() {
  const response = await apiFetch("/api");
  const APIs = await response.json();

  // keep a copy so the History button does not need another request
  window.currentAPIs = APIs;

  displayAPIs(APIs);

  // responseChart.js is loaded after this file
  if (typeof refreshChart === "function") refreshChart(APIs);
}

function buildHealthInfo(api) {
  const info = el("div", "health-info");

  if (api.status === "Unknown") {
    info.append(el("span", "", "Not checked yet"));
    return info;
  }

  const isHealthy = api.status === "Healthy";

  info.append(
    el(
      "span",
      isHealthy ? "healthy" : "down",
      isHealthy ? "🟢 Healthy" : "🔴 Down",
    ),
    el("span", "", `Status: ${api.statusCode || "No response"}`),
    el("span", "", `Response: ${api.responseTime} ms`),
  );

  if (api.uptime !== null) {
    info.append(el("span", "", `Uptime: ${api.uptime}%`));
  }

  info.append(el("span", "", `Last checked: ${formatTime(api.lastChecked)}`));

  return info;
}

function buildButton(label, onClick) {
  const button = el("button", "", label);
  button.addEventListener("click", onClick);
  return button;
}

// Display APIs on the page
function displayAPIs(APIs) {
  apiList.replaceChildren();

  totalApis.textContent = APIs.length;
  healthyApis.textContent = APIs.filter(
    (api) => api.status === "Healthy",
  ).length;
  downApis.textContent = APIs.filter((api) => api.status === "Down").length;

  APIs.forEach((api) => {
    const card = el("div", "api-card");

    const details = el("div");
    details.append(
      el("h3", "", api.name),
      el("p", "", api.url),
      buildHealthInfo(api),
    );

    const actions = el("div");
    actions.append(
      buildButton("Check", (event) => checkAPI(api.id, event.target)),
      buildButton("History", () => showHistory(api.id)),
      buildButton("Delete", () => deleteAPI(api.id)),
    );

    card.append(details, actions);
    apiList.append(card);
  });
}

// Check API health right now
async function checkAPI(id, button) {
  button.disabled = true;
  button.textContent = "Checking...";

  try {
    await apiFetch(`/api/${id}/check`, { method: "POST" });
    await loadAPIs();
  } catch (error) {
    showToast("Could not run the check");
  }
}

// Delete API
async function deleteAPI(id) {
  if (!confirm("Are you sure you want to delete this API?")) return;

  const response = await apiFetch(`/api/${id}`, { method: "DELETE" });
  const result = await response.json();

  showToast(result.message);
  loadAPIs();
}

// Add API
document.getElementById("addButton").addEventListener("click", async () => {
  const nameInput = document.getElementById("apiName");
  const urlInput = document.getElementById("apiUrl");

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    showToast("Please enter API name and URL");
    return;
  }

  const response = await apiFetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url }),
  });

  const result = await response.json();

  if (!response.ok) {
    showToast(result.message);
    return;
  }

  showToast(`${result.name} added`);

  nameInput.value = "";
  urlInput.value = "";

  loadAPIs();
});

// Show recent checks for one API
function showHistory(id) {
  const api = (window.currentAPIs || []).find((item) => item.id === id);

  if (!api) return;

  if (api.history.length === 0) {
    showToast("No check history available yet");
    return;
  }

  const lines = api.history
    .map(
      (check) =>
        `${formatTime(check.time)} | ${check.healthy ? "OK" : "FAIL"} | ` +
        `Status: ${check.statusCode || "No response"} | ${check.responseTime} ms`,
    )
    .join("\n");

  alert(`History for ${api.name}\n\n${lines}`);
}

// Load APIs when page opens, then refresh every 5 seconds
loadAPIs();
setInterval(loadAPIs, 5000);
