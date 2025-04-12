/**
 * Main JavaScript for Person Detection System
 * Controls theme switching, sidebar behavior, and global UI interactions
 */

// DOM elements
const appBody = document.getElementById('app-body');
const sidebar = document.getElementById('sidebar');
const content = document.getElementById('content');
const menuToggle = document.getElementById('menu-toggle');
const themeToggle = document.getElementById('theme-toggle');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');
const errorBtn = document.getElementById('error-btn');
const errorCount = document.getElementById('error-count');
const systemStatus = document.getElementById('system-status');

// System state
let systemHealthTimer;
let isSystemActive = true;
let activeErrorCount = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initNotifications();
  checkSystemHealth();
  startErrorPolling();
});

// Theme management
function initTheme() {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  // Theme toggle button
  themeToggle.addEventListener('click', () => {
    const newTheme = appBody.classList.contains('theme-light') ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

function setTheme(theme) {
  if (theme === 'dark') {
    appBody.classList.remove('theme-light');
    appBody.classList.add('theme-dark');
  } else {
    appBody.classList.remove('theme-dark');
    appBody.classList.add('theme-light');
  }
}

// Sidebar management
function initSidebar() {
  // Check for saved sidebar preference
  const sidebarState = localStorage.getItem('sidebar-collapsed') === 'true';
  if (sidebarState) {
    appBody.classList.add('sidebar-collapsed');
  }

  // Menu toggle button
  menuToggle.addEventListener('click', () => {
    appBody.classList.toggle('sidebar-collapsed');
    appBody.classList.toggle('sidebar-open');
    localStorage.setItem('sidebar-collapsed', appBody.classList.contains('sidebar-collapsed'));
  });

  // Close sidebar on mobile when clicking content area
  content.addEventListener('click', () => {
    if (window.innerWidth < 768 && !appBody.classList.contains('sidebar-collapsed')) {
      appBody.classList.add('sidebar-collapsed');
      appBody.classList.remove('sidebar-open');
      localStorage.setItem('sidebar-collapsed', 'true');
    }
  });
}

// Notification system
function initNotifications() {
  notificationClose.addEventListener('click', hideNotification);
}

function showNotification(message, type = 'info', duration = 3000) {
  notificationMessage.textContent = message;
  notification.className = `notification visible ${type}`;
  
  // Auto-hide after duration
  if (duration > 0) {
    setTimeout(hideNotification, duration);
  }
}

function hideNotification() {
  notification.classList.remove('visible');
}

// System health check
function checkSystemHealth() {
  // Clear any existing timer
  if (systemHealthTimer) {
    clearTimeout(systemHealthTimer);
  }

  // Request health status from server
  fetch('/health')
    .then(response => {
      if (!response.ok) {
        throw new Error('Health check request failed');
      }
      return response.json();
    })
    .then(data => {
      updateSystemStatus(data);
    })
    .catch(error => {
      console.error('Health check error:', error);
      setSystemStatus('error', 'System Error');
    })
    .finally(() => {
      // Schedule next check
      systemHealthTimer = setTimeout(checkSystemHealth, 30000); // Check every 30 seconds
    });
}

function updateSystemStatus(data) {
  if (data.status === 'ok') {
    setSystemStatus('active', 'System Active');
    isSystemActive = true;
  } else if (data.status === 'warning') {
    setSystemStatus('warning', 'System Warning');
    isSystemActive = true;
  } else {
    setSystemStatus('error', 'System Error');
    isSystemActive = false;
  }
  
  // Update system metrics if the page has these elements
  updateSystemMetrics(data);
}

function setSystemStatus(status, text) {
  const indicator = systemStatus.querySelector('.status-indicator');
  const statusText = systemStatus.querySelector('.status-text');
  
  indicator.className = `status-indicator ${status}`;
  statusText.textContent = text;
}

function updateSystemMetrics(data) {
  // Only update if these elements exist (on home page)
  const cpuUsage = document.getElementById('cpu-usage');
  const memoryUsage = document.getElementById('memory-usage');
  const storageUsage = document.getElementById('storage-usage');
  const temperature = document.getElementById('temperature');
  
  if (cpuUsage) cpuUsage.textContent = data.cpu_usage || '0%';
  if (memoryUsage) memoryUsage.textContent = data.memory_usage || '0 MB';
  if (storageUsage) storageUsage.textContent = data.storage || '0 MB';
  if (temperature) temperature.textContent = data.temperature || '0°C';
}

// Error monitoring
function startErrorPolling() {
  // Check for errors every 60 seconds
  setInterval(checkErrors, 60000);
  
  // Initial check
  checkErrors();
  
  // Error button click
  errorBtn.addEventListener('click', () => {
    window.location.href = '/errors';
  });
}

function checkErrors() {
  fetch('/api/errors/count')
    .then(response => response.json())
    .then(data => {
      activeErrorCount = data.count;
      errorCount.textContent = activeErrorCount > 0 ? activeErrorCount : '';
      
      // Notify user of new errors
      if (data.new > 0) {
        const message = data.new === 1 
          ? '1 new error detected' 
          : `${data.new} new errors detected`;
        showNotification(message, 'danger', 5000);
      }
    })
    .catch(error => {
      console.error('Error checking errors:', error);
    });
}

// Utility functions
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}
