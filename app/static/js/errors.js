/**
 * Errors page JavaScript for Person Detection System
 * Handles error display, filtering, resolution, and detail views
 */

// DOM elements
const errorList = document.getElementById('error-list');
const errorSearch = document.getElementById('error-search');
const showActiveBtn = document.getElementById('show-active-btn');
const showResolvedBtn = document.getElementById('show-resolved-btn');
const showAllBtn = document.getElementById('show-all-btn');
const refreshErrorsBtn = document.getElementById('refresh-errors-btn');
const clearResolvedBtn = document.getElementById('clear-resolved-btn');
const noErrors = document.getElementById('no-errors');
const errorDetailModal = document.getElementById('error-detail-modal');
const errorDetailClose = document.getElementById('error-detail-close');
const detailTimestamp = document.getElementById('detail-timestamp');
const detailStatus = document.getElementById('detail-status');
const detailMessage = document.getElementById('detail-message');
const detailStacktrace = document.getElementById('detail-stacktrace');
const detailResolveBtn = document.getElementById('detail-resolve-btn');

// State variables
let errorData = [];
let currentFilter = 'active';  // active, resolved, all
let isLoading = false;
let currentDetailId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadErrors();
  initEventListeners();
});

// Initialize event listeners
function initEventListeners() {
  // Filter buttons
  showActiveBtn.addEventListener('click', () => {
    setFilter('active');
  });
  
  showResolvedBtn.addEventListener('click', () => {
    setFilter('resolved');
  });
  
  showAllBtn.addEventListener('click', () => {
    setFilter('all');
  });
  
  // Refresh button
  refreshErrorsBtn.addEventListener('click', () => {
    loadErrors();
  });
  
  // Clear resolved errors button
  clearResolvedBtn.addEventListener('click', () => {
    clearResolvedErrors();
  });
  
  // Search input with debounce
  let searchTimeout;
  errorSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterErrors();
    }, 300);
  });
  
  // Modal close button
  errorDetailClose.addEventListener('click', () => {
    errorDetailModal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === errorDetailModal) {
      errorDetailModal.style.display = 'none';
    }
  });
  
  // Detail resolve button
  detailResolveBtn.addEventListener('click', () => {
    if (currentDetailId !== null) {
      resolveError(currentDetailId);
      errorDetailModal.style.display = 'none';
    }
  });
}

// Set active filter
function setFilter(filter) {
  currentFilter = filter;
  
  // Update button states
  showActiveBtn.classList.remove('active');
  showResolvedBtn.classList.remove('active');
  showAllBtn.classList.remove('active');
  
  switch (filter) {
    case 'active':
      showActiveBtn.classList.add('active');
      break;
    case 'resolved':
      showResolvedBtn.classList.add('active');
      break;
    case 'all':
      showAllBtn.classList.add('active');
      break;
  }
  
  filterErrors();
}

// Load errors from server
function loadErrors() {
  isLoading = true;
  showLoadingState();
  
  // Fetch errors from API
  fetch('/api/errors')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch errors');
      return response.json();
    })
    .then(data => {
      errorData = data;
      filterErrors();
    })
    .catch(error => {
      console.error('Error loading errors:', error);
      errorList.innerHTML = `
        <div class="error-message">
          Failed to load errors: ${error.message}
        </div>
      `;
    })
    .finally(() => {
      isLoading = false;
    });
}

// Show loading state
function showLoadingState() {
  errorList.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading errors...</span>
    </div>
  `;
}

// Filter errors based on current filter and search
function filterErrors() {
  if (isLoading) return;
  
  // Apply filter and search
  let filtered = [...errorData];
  
  // Filter by status
  if (currentFilter === 'active') {
    filtered = filtered.filter(error => error.resolved === 0);
  } else if (currentFilter === 'resolved') {
    filtered = filtered.filter(error => error.resolved === 1);
  }
  
  // Filter by search query
  const searchQuery = errorSearch.value.toLowerCase().trim();
  if (searchQuery) {
    filtered = filtered.filter(error => 
      error.message.toLowerCase().includes(searchQuery) ||
      (error.stacktrace && error.stacktrace.toLowerCase().includes(searchQuery))
    );
  }
  
  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  
  renderErrors(filtered);
}

// Render errors list
function renderErrors(errors) {
  if (errors.length === 0) {
    errorList.innerHTML = '';
    noErrors.style.display = 'flex';
    return;
  }
  
  noErrors.style.display = 'none';
  
  // Get error item template
  const template = document.getElementById('error-item-template');
  
  // Clear current list
  errorList.innerHTML = '';
  
  // Render each error
  errors.forEach(error => {
    // Clone template
    const errorItem = template.content.cloneNode(true);
    const item = errorItem.querySelector('.error-item');
    
    // Set data attributes
    item.dataset.timestamp = error.timestamp;
    item.dataset.resolved = error.resolved;
    
    // Set content
    item.querySelector('.error-timestamp').textContent = formatTimestamp(error.timestamp);
    item.querySelector('.error-message').textContent = truncateText(error.message, 300);
    
    // Set up buttons
    const resolveBtn = item.querySelector('.resolve-btn');
    const detailsBtn = item.querySelector('.details-btn');
    
    resolveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resolveError(error.timestamp);
    });
    
    detailsBtn.addEventListener('click', () => {
      showErrorDetail(error);
    });
    
    // Add to list
    errorList.appendChild(item);
  });
}

// Truncate text to specified length
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
}

// Show error detail modal
function showErrorDetail(error) {
  currentDetailId = error.timestamp;
  
  // Update modal content
  detailTimestamp.textContent = formatTimestamp(error.timestamp);
  detailStatus.textContent = error.resolved ? 'Resolved' : 'Active';
  detailStatus.className = error.resolved ? 'success-text' : 'danger-text';
  detailMessage.textContent = error.message;
  
  // Check if stacktrace exists
  const stacktraceContainer = document.getElementById('detail-stacktrace-container');
  if (error.stacktrace) {
    detailStacktrace.textContent = error.stacktrace;
    stacktraceContainer.style.display = 'block';
  } else {
    stacktraceContainer.style.display = 'none';
  }
  
  // Show/hide resolve button based on status
  detailResolveBtn.style.display = error.resolved ? 'none' : 'block';
  
  // Show modal
  errorDetailModal.style.display = 'block';
}

// Mark error as resolved
function resolveError(timestamp) {
  // Update UI first for responsiveness
  const errorItem = document.querySelector(`.error-item[data-timestamp="${timestamp}"]`);
  if (errorItem) {
    errorItem.dataset.resolved = "1";
  }
  
  // Update local data
  const error = errorData.find(e => e.timestamp === timestamp);
  if (error) {
    error.resolved = 1;
  }
  
  // Send request to server
  fetch(`/api/errors/${timestamp}/resolve`, {
    method: 'POST'
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to resolve error');
      return response.json();
    })
    .then(() => {
      // Refresh filter if needed
      if (currentFilter === 'active') {
        filterErrors();
      }
      showNotification('Error marked as resolved', 'success');
    })
    .catch(error => {
      console.error('Error resolving error:', error);
      showNotification('Failed to resolve error', 'danger');
      // Revert UI change
      loadErrors();
    });
}

// Clear all resolved errors
function clearResolvedErrors() {
  const confirmed = confirm('Are you sure you want to permanently delete all resolved errors?');
  if (!confirmed) return;
  
  fetch('/api/errors/clear-resolved', {
    method: 'POST'
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to clear resolved errors');
      return response.json();
    })
    .then(data => {
      showNotification(`${data.count} resolved errors cleared`, 'success');
      loadErrors();
    })
    .catch(error => {
      console.error('Error clearing errors:', error);
      showNotification('Failed to clear resolved errors', 'danger');
    });
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}
