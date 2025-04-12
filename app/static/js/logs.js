/**
 * Logs page JavaScript for Person Detection System
 * Handles log data display, pagination, filtering, and export
 */

// DOM elements
const logsTable = document.getElementById('logs-table');
const logsBody = document.getElementById('logs-body');
const logSearch = document.getElementById('log-search');
const dateFrom = document.getElementById('date-from');
const dateTo = document.getElementById('date-to');
const dateFilterApply = document.getElementById('date-filter-apply');
const prevPage = document.getElementById('prev-page');
const nextPage = document.getElementById('next-page');
const paginationInfo = document.getElementById('pagination-info');
const exportBtn = document.getElementById('export-btn');
const exportCsv = document.getElementById('export-csv');
const exportJson = document.getElementById('export-json');
const exportPdf = document.getElementById('export-pdf');
const logDetailModal = document.getElementById('log-detail-modal');
const logDetailClose = document.getElementById('log-detail-close');
const detailTimestamp = document.getElementById('detail-timestamp');
const detailCount = document.getElementById('detail-count');
const detailConfidence = document.getElementById('detail-confidence');
const detailStatus = document.getElementById('detail-status');

// State variables
let currentPage = 1;
let totalPages = 1;
let pageSize = 25;
let totalRecords = 0;
let currentSearchQuery = '';
let currentDateFilter = {
  from: null,
  to: null
};
let sortColumn = 'timestamp';
let sortDirection = 'desc';
let logData = [];

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initDateFilters();
  initSorting();
  initSearch();
  initExport();
  initPagination();
  loadLogs();
  
  // Close modal when clicking outside or on close button
  logDetailClose.addEventListener('click', () => {
    logDetailModal.classList.remove('visible');
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === logDetailModal) {
      logDetailModal.classList.remove('visible');
    }
  });
});

// Initialize date filters with defaults
function initDateFilters() {
  // Default 'from' to 7 days ago
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  dateFrom.valueAsDate = fromDate;
  
  // Default 'to' to today
  const toDate = new Date();
  dateTo.valueAsDate = toDate;
  
  // Set up filter button
  dateFilterApply.addEventListener('click', () => {
    currentDateFilter = {
      from: dateFrom.value ? new Date(dateFrom.value).getTime() / 1000 : null,
      to: dateTo.value ? new Date(dateTo.value).setHours(23, 59, 59, 999) / 1000 : null
    };
    
    // Reset to first page and reload
    currentPage = 1;
    loadLogs();
  });
}

// Initialize column sorting
function initSorting() {
  const headers = logsTable.querySelectorAll('th.sortable');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      
      // Toggle direction if clicking same column
      if (column === sortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'desc';
      }
      
      // Update UI
      headers.forEach(h => {
        h.classList.remove('active');
        h.querySelector('.sort-icon').textContent = '';
      });
      
      header.classList.add('active');
      header.querySelector('.sort-icon').textContent = 
        sortDirection === 'asc' ? '▲' : '▼';
      
      // Reload data
      loadLogs();
    });
  });
}

// Initialize search functionality
function initSearch() {
  // Debounce search input to avoid too many requests
  let searchTimeout;
  
  logSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      currentSearchQuery = logSearch.value;
      currentPage = 1;
      loadLogs();
    }, 500);
  });
}

// Initialize export functionality
function initExport() {
  // Toggle dropdown
  exportBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const dropdown = document.querySelector('.dropdown-menu');
    dropdown.classList.toggle('show');
  });
  
  // Close dropdown when clicking elsewhere
  document.addEventListener('click', () => {
    const dropdown = document.querySelector('.dropdown-menu');
    if (dropdown.classList.contains('show')) {
      dropdown.classList.remove('show');
    }
  });
  
  // Export buttons
  exportCsv.addEventListener('click', () => exportData('csv'));
  exportJson.addEventListener('click', () => exportData('json'));
  exportPdf.addEventListener('click', () => exportData('pdf'));
}

// Initialize pagination controls
function initPagination() {
  prevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadLogs();
    }
  });
  
  nextPage.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadLogs();
    }
  });
}

// Load logs with current filters and pagination
function loadLogs() {
  // Show loading state
  logsBody.innerHTML = '<tr class="loading-row"><td colspan="4">Loading data...</td></tr>';
  updatePaginationControls();
  
  // Build query parameters
  const params = new URLSearchParams({
    page: currentPage,
    page_size: pageSize,
    sort_by: sortColumn,
    sort_order: sortDirection
  });
  
  if (currentSearchQuery) {
    params.append('search', currentSearchQuery);
  }
  
  if (currentDateFilter.from) {
    params.append('from_time', Math.floor(currentDateFilter.from));
  }
  
  if (currentDateFilter.to) {
    params.append('to_time', Math.floor(currentDateFilter.to));
  }
  
  // Fetch logs from API
  fetch(`/api/logs?${params.toString()}`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    })
    .then(data => {
      logData = data.records;
      totalRecords = data.total;
      totalPages = Math.ceil(totalRecords / pageSize);
      
      // Render table
      renderLogsTable(data.records);
      updatePaginationControls();
    })
    .catch(error => {
      console.error('Error loading logs:', error);
      logsBody.innerHTML = `
        <tr class="error-row">
          <td colspan="4">Failed to load logs: ${error.message}</td>
        </tr>
      `;
    });
}

// Render logs table with data
function renderLogsTable(logs) {
  if (logs.length === 0) {
    logsBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">No logs found matching your criteria</td>
      </tr>
    `;
    return;
  }
  
  // Build table rows
  const rows = logs.map(log => `
    <tr data-id="${log.timestamp}">
      <td>${formatTimestamp(log.timestamp)}</td>
      <td>${log.count}</td>
      <td>${(log.confidence * 100).toFixed(1)}%</td>
      <td>
        <button class="btn btn-sm view-details" data-timestamp="${log.timestamp}">
          <svg viewBox="0 0 24 24">
            <path d="M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5Z" />
          </svg>
          <span>View</span>
        </button>
      </td>
    </tr>
  `).join('');
  
  // Update table
  logsBody.innerHTML = rows;
  
  // Add event listeners for detail view buttons
  document.querySelectorAll('.view-details').forEach(button => {
    button.addEventListener('click', () => {
      const timestamp = parseInt(button.dataset.timestamp);
      showLogDetail(timestamp);
    });
  });
}

// Update pagination controls
function updatePaginationControls() {
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= totalPages;
  
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);
  
  if (totalRecords === 0) {
    paginationInfo.textContent = 'No records';
  } else {
    paginationInfo.textContent = `${start}-${end} of ${totalRecords}`;
  }
}

// Show log detail modal
function showLogDetail(timestamp) {
  // Find log entry
  const log = logData.find(entry => entry.timestamp === timestamp);
  
  if (!log) {
    showNotification('Log entry not found', 'danger');
    return;
  }
  
  // Update modal content
  detailTimestamp.textContent = formatTimestamp(log.timestamp);
  detailCount.textContent = log.count;
  detailConfidence.textContent = `${(log.confidence * 100).toFixed(1)}%`;
  
  // Determine status text based on count and confidence
  let statusText = 'Normal';
  if (log.count > 5) {
    statusText = 'High Traffic';
  } else if (log.confidence < 0.5) {
    statusText = 'Low Confidence';
  }
  detailStatus.textContent = statusText;
  
  // Show modal
  logDetailModal.classList.add('visible');
}

// Export data in different formats
function exportData(format) {
  // Build query parameters for export
  const params = new URLSearchParams({
    format: format,
    sort_by: sortColumn,
    sort_order: sortDirection
  });
  
  if (currentSearchQuery) {
    params.append('search', currentSearchQuery);
  }
  
  if (currentDateFilter.from) {
    params.append('from_time', Math.floor(currentDateFilter.from));
  }
  
  if (currentDateFilter.to) {
    params.append('to_time', Math.floor(currentDateFilter.to));
  }
  
  // Create URL for export
  const exportUrl = `/api/logs/export?${params.toString()}`;
  
  // Download file
  window.location.href = exportUrl;
}
