/**
 * Dashboard JavaScript for Person Detection System
 * Handles data visualization, charts, and real-time metrics
 */

// DOM elements
const countChart = document.getElementById('count-chart');
const currentCount = document.getElementById('current-count');
const countTrend = document.getElementById('count-trend');
const countTrendValue = document.getElementById('count-trend-value');
const confidenceGauge = document.getElementById('gauge-value-path');
const confidenceText = document.getElementById('gauge-value-text');
const totalToday = document.getElementById('total-today');
const hourlyAverage = document.getElementById('hourly-average');
const peakTime = document.getElementById('peak-time');
const peakCount = document.getElementById('peak-count');
const memoryBar = document.getElementById('memory-bar');
const memoryValue = document.getElementById('memory-value');
const storageBar = document.getElementById('storage-bar');
const storageValue = document.getElementById('storage-value');
const temperatureBar = document.getElementById('temperature-bar');
const temperatureValue = document.getElementById('temperature-value');
const uptimeValue = document.getElementById('uptime-value');
const refreshBtn = document.getElementById('refresh-btn');

// Chart instance
let peopleCountChart = null;

// State variables
let chartData = [];
let lastCount = 0;
let startTime = Date.now();

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  loadDashboardData();
  initEventSource();
  
  // Refresh button
  refreshBtn.addEventListener('click', () => {
    loadDashboardData();
    refreshBtn.classList.add('refreshing');
    setTimeout(() => {
      refreshBtn.classList.remove('refreshing');
    }, 1000);
  });
  
  // Update uptime every second
  setInterval(updateUptime, 1000);
});

// Initialize charts
function initCharts() {
  // Initialize people count chart
  const ctx = countChart.getContext('2d');
  
  peopleCountChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'People Count',
        data: [],
        fill: true,
        backgroundColor: 'rgba(13, 110, 253, 0.2)',
        borderColor: 'rgba(13, 110, 253, 1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(13, 110, 253, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `Count: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 10,
            callback: function(value, index) {
              const label = this.getLabelForValue(value);
              // Format time label to just show time
              return label.split(' ')[1];
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            drawBorder: false
          },
          ticks: {
            precision: 0
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

// Load dashboard data
function loadDashboardData() {
  // Load chart data
  fetch('/api/detections?minutes=10')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch detection data');
      return response.json();
    })
    .then(data => {
      updateChartData(data);
    })
    .catch(error => {
      console.error('Error loading chart data:', error);
      showNotification('Failed to load detection data', 'danger');
    });
    
  // Load summary data
  fetch('/api/summary')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch summary data');
      return response.json();
    })
    .then(data => {
      updateSummary(data);
    })
    .catch(error => {
      console.error('Error loading summary data:', error);
      showNotification('Failed to load summary data', 'danger');
    });
    
  // Load system health data
  fetch('/health')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch health data');
      return response.json();
    })
    .then(data => {
      updateSystemHealth(data);
    })
    .catch(error => {
      console.error('Error loading health data:', error);
    });
}

// Update chart with new data
function updateChartData(data) {
  chartData = data;
  
  // Extract timestamps and counts
  const labels = data.map(item => formatTimestamp(item.timestamp));
  const counts = data.map(item => item.count);
  
  // Update chart
  peopleCountChart.data.labels = labels;
  peopleCountChart.data.datasets[0].data = counts;
  peopleCountChart.update();
  
  // Update current count if we have data
  if (data.length > 0) {
    const currentDetection = data[data.length - 1];
    updateCurrentCount(currentDetection.count);
    updateConfidenceGauge(currentDetection.confidence);
  }
}

// Update current count and trend
function updateCurrentCount(count) {
  // Get previous count
  const prevCount = lastCount;
  lastCount = count;
  
  // Update count display
  currentCount.textContent = count;
  
  // Calculate and display trend
  if (prevCount > 0) {
    const trendPercentage = ((count - prevCount) / prevCount) * 100;
    const trendUp = document.querySelector('.trend-up');
    const trendDown = document.querySelector('.trend-down');
    
    if (count > prevCount) {
      trendUp.style.display = 'inline-block';
      trendDown.style.display = 'none';
      countTrendValue.style.color = 'var(--success)';
      countTrendValue.textContent = `+${Math.abs(trendPercentage).toFixed(1)}%`;
    } else if (count < prevCount) {
      trendUp.style.display = 'none';
      trendDown.style.display = 'inline-block';
      countTrendValue.style.color = 'var(--danger)';
      countTrendValue.textContent = `-${Math.abs(trendPercentage).toFixed(1)}%`;
    } else {
      trendUp.style.display = 'none';
      trendDown.style.display = 'none';
      countTrendValue.style.color = 'var(--secondary)';
      countTrendValue.textContent = '0%';
    }
  } else {
    // No previous count
    document.querySelector('.trend-up').style.display = 'none';
    document.querySelector('.trend-down').style.display = 'none';
    countTrendValue.textContent = '';
  }
}

// Update confidence gauge
function updateConfidenceGauge(confidence) {
  const percentage = (confidence || 0) * 100;
  
  // Update text
  confidenceText.textContent = `${percentage.toFixed(0)}%`;
  
  // Update gauge
  // The gauge path is a semi-circle with circumference = PI * r * 2 = PI * 80 = 251.2
  // We only show the top half of the circle
  const gaugeLength = 251.2 / 2;
  const gaugeValue = (percentage / 100) * gaugeLength;
  
  // SVG arc path calculation
  confidenceGauge.setAttribute('d', describeArc(60, 60, 40, 180, 180 - (180 * percentage / 100)));
}

// Calculate SVG arc path
function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

// Update summary information
function updateSummary(data) {
  totalToday.textContent = data.total_today || 0;
  hourlyAverage.textContent = (data.hourly_average || 0).toFixed(1);
  
  if (data.peak_time) {
    const peakDate = new Date(data.peak_time * 1000);
    peakTime.textContent = peakDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    peakTime.textContent = '-';
  }
  
  peakCount.textContent = data.peak_count || 0;
}

// Update system health information
function updateSystemHealth(data) {
  // Memory usage
  if (data.memory_usage) {
    const memoryMatch = data.memory_usage.match(/(\d+(\.\d+)?)/);
    if (memoryMatch) {
      const memoryUsed = parseFloat(memoryMatch[0]);
      const memoryPercentage = Math.min((memoryUsed / 500) * 100, 100);
      memoryBar.style.width = `${memoryPercentage}%`;
      memoryValue.textContent = `${data.memory_usage}/500 MB`;
      
      if (memoryPercentage > 90) {
        memoryBar.style.backgroundColor = 'var(--danger)';
      } else if (memoryPercentage > 75) {
        memoryBar.style.backgroundColor = 'var(--warning)';
      } else {
        memoryBar.style.backgroundColor = 'var(--success)';
      }
    }
  }
  
  // Storage usage
  if (data.storage) {
    const storageMatch = data.storage.match(/(\d+(\.\d+)?)/);
    if (storageMatch) {
      const storageUsed = parseFloat(storageMatch[0]);
      const storagePercentage = Math.min((storageUsed / 200) * 100, 100);
      storageBar.style.width = `${storagePercentage}%`;
      storageValue.textContent = `${data.storage}/200 MB`;
      
      if (storagePercentage > 90) {
        storageBar.style.backgroundColor = 'var(--danger)';
      } else if (storagePercentage > 75) {
        storageBar.style.backgroundColor = 'var(--warning)';
      } else {
        storageBar.style.backgroundColor = 'var(--success)';
      }
    }
  }
  
  // Temperature
  if (data.temperature) {
    const tempMatch = data.temperature.match(/(\d+(\.\d+)?)/);
    if (tempMatch) {
      const temp = parseFloat(tempMatch[0]);
      const tempPercentage = Math.min((temp / 85) * 100, 100); // Assuming 85°C is max safe temp for RPi
      temperatureBar.style.width = `${tempPercentage}%`;
      temperatureValue.textContent = data.temperature;
      
      if (tempPercentage > 90) {
        temperatureBar.style.backgroundColor = 'var(--danger)';
      } else if (tempPercentage > 75) {
        temperatureBar.style.backgroundColor = 'var(--warning)';
      } else {
        temperatureBar.style.backgroundColor = 'var(--success)';
      }
    }
  }
}

// Update uptime counter
function updateUptime() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  uptimeValue.textContent = formatDuration(uptime);
}

// Initialize Server-Sent Events for real-time updates
function initEventSource() {
  const eventSource = new EventSource('/api/count');
  
  // Connection opened
  eventSource.onopen = (event) => {
    console.log('SSE connection established');
  };
  
  // Listen for detection events
  eventSource.addEventListener('detection', (event) => {
    const data = JSON.parse(event.data);
    
    // Update current count
    updateCurrentCount(data.count);
    updateConfidenceGauge(data.confidence);
    
    // Add to chart if we have at least 10 seconds since last point
    const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
    if (!lastPoint || data.timestamp - lastPoint.timestamp >= 10) {
      // Add new point to chart
      const newPoint = {
        timestamp: data.timestamp,
        count: data.count,
        confidence: data.confidence
      };
      
      chartData.push(newPoint);
      
      // Remove oldest point if we have more than 60 points (10 minutes at 1 point per 10 seconds)
      if (chartData.length > 60) {
        chartData.shift();
      }
      
      // Update chart
      peopleCountChart.data.labels = chartData.map(item => formatTimestamp(item.timestamp));
      peopleCountChart.data.datasets[0].data = chartData.map(item => item.count);
      peopleCountChart.update('quiet'); // Use quiet mode for smoother updates
    }
  });
  
  // Error handling
  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      setTimeout(initEventSource, 5000); // Try to reconnect after 5 seconds
    }
  };
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}
