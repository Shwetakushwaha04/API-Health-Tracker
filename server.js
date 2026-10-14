const express = require("express");
const axios = require("axios");

const authRoutes = require("./authRoutes");
const { authenticateToken } = require("./auth");

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.use("/", authRoutes);

let APIs = [];
// let APIs = [
//   {
//     id: 1,
//     userId: null,
//     name: "GitHub API",
//     url: "https://api.github.com",
//     status: "Unknown",
//     statusCode: null,
//     responseTime: null,
//     lastChecked: null,
//     history: [],
//   },
//   {
//     id: 2,
//     name: "Example API",
//     url: "https://example.com",
//     status: "Unknown",
//     statusCode: null,
//     responseTime: null,
//     lastChecked: null,
//     history: [],
//   },
// ];

// GET all APIs
app.get("/api", authenticateToken, (req, res) => {
  let userAPIs = APIs.filter((api) => api.userId === req.user.id);

  // Give new users the default APIs once
  if (userAPIs.length === 0) {
    const defaultAPIs = [
      {
        id: Date.now(),
        userId: req.user.id,
        name: "Pokeapi",
        url: "https://pokeapi.co/",
        status: "Unknown",
        statusCode: null,
        responseTime: null,
        lastChecked: null,
        history: [],
      },
      {
        id: Date.now() + 1,
        userId: req.user.id,
        name: "Example API",
        url: "https://example.com",
        status: "Unknown",
        statusCode: null,
        responseTime: null,
        lastChecked: null,
        history: [],
      },
    ];

    APIs.push(...defaultAPIs);

    userAPIs = defaultAPIs;
  }

  res.json(userAPIs);
});

// POST - Add a new API
app.post("/api", authenticateToken, (req, res) => {
  const { name, url } = req.body;

  const newAPI = {
    id: Date.now(),
    userId: req.user.id,
    name: name,
    url: url,
    status: "Unknown",
    statusCode: null,
    responseTime: null,
    lastChecked: null,
    history: [],
  };

  APIs.push(newAPI);

  res.status(201).json(newAPI);
});

// Function to check API health
async function checkAPIHealth(api) {
  const startTime = Date.now();

  try {
    const response = await axios.get(api.url, {
      timeout: 5000,

      headers: {
        "User-Agent": "API-Monitoring-Tool",
        Accept: "application/json",
      },
    });

    const responseTime = Date.now() - startTime;

    api.status = "Healthy";
    api.statusCode = response.status;
    api.responseTime = responseTime;
    api.lastChecked = new Date();

    api.history.push({
      time: new Date(),
      statusCode: response.status,
      responseTime: responseTime,
    });

    if (api.history.length > 10) {
      api.history.shift();
    }

    return api;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    api.status = "Down";
    api.statusCode = error.response?.status || null;
    api.responseTime = responseTime;
    api.lastChecked = new Date();

    api.history.push({
      time: new Date(),
      statusCode: error.response?.status || null,
      responseTime: responseTime,
    });

    if (api.history.length > 10) {
      api.history.shift();
    }

    console.log(
      `${api.name} failed:`,
      error.response?.status || error.code || error.message,
    );

    return api;
  }
}

// Manual check
app.post("/api/:id/check", authenticateToken, async (req, res) => {
  const id = Number(req.params.id);

  const api = APIs.find(
    (item) => item.id === id && item.userId === req.user.id,
  );

  if (!api) {
    return res.status(404).json({
      message: "API not found",
    });
  }

  const result = await checkAPIHealth(api);

  res.json(result);
});

// DELETE - Delete an API
app.delete("/api/:id", authenticateToken, (req, res) => {
  const id = Number(req.params.id);

  const apiIndex = APIs.findIndex(
    (item) => item.id === id && item.userId === req.user.id,
  );

  if (apiIndex === -1) {
    return res.status(404).json({
      message: "API not found",
    });
  }

  const deletedAPI = APIs.splice(apiIndex, 1);

  res.json({
    message: "API deleted successfully",
    api: deletedAPI[0],
  });
});

// Automatically check all APIs
async function checkAllAPIs() {
  console.log("Running automatic API check...");

  for (const api of APIs) {
    await checkAPIHealth(api);

    console.log(
      `${api.name}: ${api.status} | ${api.statusCode || "No response"} | ${api.responseTime} ms`,
    );
  }
}

// Check immediately when server starts
checkAllAPIs();

// Then check every 30 seconds
setInterval(checkAllAPIs, 30000);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
