// Get token from browser
function getToken() {
  return localStorage.getItem("token");
}

// Get authorization headers
function getAuthHeaders() {
  const token = getToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}

// Login
async function login(username, password) {
  const response = await fetch("/login", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      username: username,
      password: password,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    alert(result.message);
    return false;
  }

  // Save JWT
  localStorage.setItem("token", result.token);

  alert("Login successful!");

  window.location.href = "/dashboard.html";

  return true;
}

// Register
async function register(username, password) {
  const response = await fetch("/register", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      username: username,
      password: password,
    }),
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
