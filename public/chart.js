const chartApiSelect = document.getElementById("chartApiSelect");
const responseChartCanvas = document.getElementById("responseChart");

let responseChart = null;

// Load APIs into dropdown
async function loadChartAPIs() {
  const response = await fetch("/api",{
    headers: getAuthHeaders(),
  });
  const APIs = await response.json();

  const currentSelection = chartApiSelect.value;

  chartApiSelect.innerHTML = `
    <option value="">Select an API</option>
  `;

  APIs.forEach((api) => {
    const option = document.createElement("option");

    option.value = api.id;
    option.textContent = api.name;

    chartApiSelect.appendChild(option);
  });

  // Keep previously selected API
  if (currentSelection) {
    chartApiSelect.value = currentSelection;
  }

  return APIs;
}

// Create or update chart
function renderChart(api) {
  if (!api || api.history.length === 0) {
    return;
  }

  const labels = api.history.map((check, index) => {
    return `Check ${index + 1}`;
  });

  const responseTimes = api.history.map((check) => {
    return check.responseTime;
  });

  // If chart doesn't exist, create it
  if (!responseChart) {
    responseChart = new Chart(responseChartCanvas, {
      type: "line",

      data: {
        labels: labels,

        datasets: [
          {
            label: `${api.name} Response Time (ms)`,

            data: responseTimes,

            borderWidth: 2,

            tension: 0.3,
          },
        ],
      },

      options: {
        responsive: true,

        scales: {
          y: {
            beginAtZero: true,

            title: {
              display: true,
              text: "Response Time (ms)",
            },
          },

          x: {
            title: {
              display: true,
              text: "Checks",
            },
          },
        },
      },
    });
  }

  // Otherwise update existing chart
  else {
    responseChart.data.labels = labels;

    responseChart.data.datasets[0].label = `${api.name} Response Time (ms)`;

    responseChart.data.datasets[0].data = responseTimes;

    responseChart.update();
  }
}

// When user selects an API
chartApiSelect.addEventListener("change", async () => {
  const apiId = Number(chartApiSelect.value);

  if (!apiId) {
    if (responseChart) {
      responseChart.destroy();
      responseChart = null;
    }

    return;
  }

  const response = await fetch("/api",{
    headers: getAuthHeaders(),
  });
  const APIs = await response.json();

  const api = APIs.find((item) => item.id === apiId);

  if (!api) {
    return;
  }

  if (api.history.length === 0) {
    alert("No check history available for this API yet.");
    return;
  }

  renderChart(api);
});

// Refresh chart data
async function refreshChart() {
  const apiId = Number(chartApiSelect.value);

  // No API selected
  if (!apiId) {
    return;
  }

  const response = await fetch("/api", {
    headers: getAuthHeaders(),
  });
  const APIs = await response.json();

  const api = APIs.find((item) => item.id === apiId);

  if (!api) {
    return;
  }

  if (api.history.length === 0) {
    return;
  }

  renderChart(api);
}

// Initial dropdown load
loadChartAPIs();

// Refresh chart every 5 seconds
setInterval(async () => {
  await loadChartAPIs();

  await refreshChart();
}, 5000);
