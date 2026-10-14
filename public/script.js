const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

const apiList = document.getElementById("apiList");

const totalApis = document.getElementById("totalApis");
const healthyApis = document.getElementById("healthyApis");
const downApis = document.getElementById("downApis");

// Get APIs from backend
async function loadAPIs() {
  const response = await fetch("/api", {
    headers: getAuthHeaders(),
  });
  const APIs = await response.json();

  displayAPIs(APIs);
}

// Display APIs on the page
function displayAPIs(APIs) {
  apiList.innerHTML = "";

  totalApis.textContent = APIs.length;

  const healthyCount = APIs.filter((api) => api.status === "Healthy").length;

  const downCount = APIs.filter((api) => api.status === "Down").length;

  healthyApis.textContent = healthyCount;
  downApis.textContent = downCount;

  APIs.forEach((api) => {
    const apiCard = document.createElement("div");

    apiCard.classList.add("api-card");

    apiCard.innerHTML = `
    <div>
      <h3>${api.name}</h3>
      <p>${api.url}</p>

      <div class="health-info" id="health-${api.id}">
        ${
          api.status === "Healthy"
            ? `
              <span class="healthy">🟢 Healthy</span>
              <span>Status: ${api.statusCode}</span>
              <span>Response: ${api.responseTime} ms</span>
              <span>Last checked: ${new Date(api.lastChecked).toLocaleString()}</span>
            `
            : api.status === "Down"
              ? `
              <span class="down">🔴 Down</span>
              <span>Status: ${api.statusCode || "No response"}</span>
              <span>Response: ${api.responseTime} ms</span>
              <span>Last checked: ${new Date(api.lastChecked).toLocaleString()}</span>
            `
              : `
              <span>Not checked yet</span>
            `
        }
      </div>
    </div>
    
    <div>
    <button onclick="checkAPI(${api.id})">
    Check
    </button>
    
    <button onclick = "showHistory(${api.id})">
    History
    </button>

    <button onclick="deleteAPI(${api.id})">
    Delete
    </button>

    
    </div>
  `;

    apiList.appendChild(apiCard);
  });
}

// Check API health
async function checkAPI(id) {
  const healthElement = document.getElementById(`health-${id}`);

  healthElement.innerHTML = "Checking...";

  const response = await fetch(`/api/${id}/check`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await response.json();

  loadAPIs();
}

// Delete API
async function deleteAPI(id) {
  const confirmed = confirm("Are you sure you want to delete this API?");

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });

  const result = await response.json();

  alert(result.message);

  loadAPIs();
}

const addButton = document.getElementById("addButton");

addButton.addEventListener("click", async () => {
  const name = document.getElementById("apiName").value;
  const url = document.getElementById("apiUrl").value;

  if (!name || !url) {
    alert("Please enter API name and URL");
    return;
  }

  const response = await fetch("/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      name: name,
      url: url,
    }),
  });

  const newAPI = await response.json();

  alert(`${newAPI.name} added successfully!`);

  document.getElementById("apiName").value = "";
  document.getElementById("apiUrl").value = "";

  loadAPIs();
});
async function showHistory(id) {
  const response = await fetch("/api");
  const APIs = await response.json();

  const api = APIs.find((item) => item.id === id);

  if (!api) {
    return;
  }

  if (api.history.length === 0) {
    alert("No check history available yet.");
    return;
  }

  const historyText = api.history
    .map((check) => {
      return `${new Date(check.time).toLocaleString()} | Status: ${
        check.statusCode || "No response"
      } | Response: ${check.responseTime} ms`;
    })
    .join("\n");

  alert(`History for ${api.name}\n\n${historyText}`);
}

// Load APIs when page opens
loadAPIs();

// Refresh dashboard every 5 seconds
setInterval(loadAPIs, 5000);
