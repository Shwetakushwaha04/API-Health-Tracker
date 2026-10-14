// Get token from browser
function getToken() {
  return localStorage.getItem("token");
}

// Get authorization headers
function getAuthHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// fetch() wrapper for logged-in requests.
// If the token is missing or expired, send the user back to the login page.
async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
    throw new Error("Session expired");
  }

  return response;
}

// Login
async function login(username, password) {
  const response = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    alert(result.message);
    return false;
  }

  // Save JWT
  localStorage.setItem("token", result.token);

  window.location.href = "/dashboard.html";

  return true;
}

// Register
async function register(username, password) {
  const response = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json();

  if (!response.ok) {
    alert(result.message);
    return false;
  }

  alert("Registration successful. Please login.");

  return true;
}

// Logout
function logout() {
  localStorage.removeItem("token");

  window.location.href = "/login.html";
}
