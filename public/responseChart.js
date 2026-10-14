const chartApiSelect = document.getElementById("chartApiSelect");
const responseChartCanvas = document.getElementById("responseChart");

let responseChart = null;

function destroyChart() {
  if (responseChart) {
    responseChart.destroy();
    responseChart = null;
  }
}

// Fill the dropdown from the list script.js already loaded
function fillDropdown(APIs) {
  const selected = chartApiSelect.value;

  chartApiSelect.replaceChildren(new Option("Select an API", ""));

  APIs.forEach((api) => {
    // new Option() sets text safely
    chartApiSelect.append(new Option(api.name, api.id));
  });

  // keep the previous selection after the refresh
  chartApiSelect.value = selected;
}

// Create the chart, or update it if it already exists
function renderChart(api) {
  const labels = api.history.map((check) =>
    new Date(check.time).toLocaleTimeString(),
  );
  const responseTimes = api.history.map((check) => check.responseTime);
  // failed checks are drawn in red
  const pointColors = api.history.map((check) =>
    check.healthy ? "#2563eb" : "#dc2626",
  );

  if (!responseChart) {
    responseChart = new Chart(responseChartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${api.name} Response Time (ms)`,
            data: responseTimes,
            borderWidth: 2,
            tension: 0.3,
            borderColor: "#2563eb",
            pointBackgroundColor: pointColors,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Response Time (ms)" },
          },
          x: { title: { display: true, text: "Time of check" } },
        },
      },
    });
    return;
  }

  const dataset = responseChart.data.datasets[0];

  responseChart.data.labels = labels;
  dataset.label = `${api.name} Response Time (ms)`;
  dataset.data = responseTimes;
  dataset.pointBackgroundColor = pointColors;
  responseChart.update();
}

// Called by script.js every time the API list is refreshed
function refreshChart(APIs) {
  fillDropdown(APIs);

  const api = APIs.find((item) => item.id === Number(chartApiSelect.value));

  if (!api || api.history.length === 0) {
    destroyChart();
    return;
  }

  renderChart(api);
}

// When the user picks a different API
chartApiSelect.addEventListener("change", () => {
  destroyChart(); // start fresh so the old API's line does not linger

  const api = (window.currentAPIs || []).find(
    (item) => item.id === Number(chartApiSelect.value),
  );

  if (api && api.history.length === 0) {
    showToast("No check history available for this API yet");
  }

  refreshChart(window.currentAPIs || []);
});
