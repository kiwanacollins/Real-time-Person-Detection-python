/**
 * Settings page JavaScript for Person Detection System
 * Manages camera and detection settings with persistence
 */

// DOM elements
const cameraSelect = document.getElementById('camera-select');
const ipCameraContainer = document.getElementById('ip-camera-container');
const ipCameraUrl = document.getElementById('ip-camera-url');
const resolutionSelect = document.getElementById('resolution-select');
const confidenceThreshold = document.getElementById('confidence-threshold');
const confidenceThresholdValue = document.getElementById('confidence-threshold-value');
const inferenceFps = document.getElementById('inference-fps');
const inferenceFpsValue = document.getElementById('inference-fps-value');
const useCoral = document.getElementById('use-coral');
const maxDbSize = document.getElementById('max-db-size');
const maxDbSizeValue = document.getElementById('max-db-size-value');
const autoCleanup = document.getElementById('auto-cleanup');
const logLevel = document.getElementById('log-level');
const enableSse = document.getElementById('enable-sse');
const powerSaving = document.getElementById('power-saving');
const startupAction = document.getElementById('startup-action');
const resetBtn = document.getElementById('reset-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const testCameraBtn = document.getElementById('test-camera-btn');

// Camera test modal elements
const cameraTestModal = document.getElementById('camera-test-modal');
const cameraTestClose = document.getElementById('camera-test-close');
const cameraTestImage = document.getElementById('camera-test-image');
const cameraTestRefresh = document.getElementById('camera-test-refresh');
const cameraTestConfirm = document.getElementById('camera-test-confirm');

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initEventListeners();
});

// Initialize event listeners
function initEventListeners() {
  // Camera type change
  cameraSelect.addEventListener('change', () => {
    ipCameraContainer.style.display = 
      cameraSelect.value === '2' ? 'block' : 'none';
  });
  
  // Range sliders
  confidenceThreshold.addEventListener('input', () => {
    confidenceThresholdValue.textContent = parseFloat(confidenceThreshold.value).toFixed(2);
  });
  
  inferenceFps.addEventListener('input', () => {
    inferenceFpsValue.textContent = `${inferenceFps.value} FPS`;
  });
  
  maxDbSize.addEventListener('input', () => {
    maxDbSizeValue.textContent = `${maxDbSize.value} MB`;
  });
  
  // Reset button
  resetBtn.addEventListener('click', resetDefaults);
  
  // Save button
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Test camera button
  testCameraBtn.addEventListener('click', testCamera);
  
  // Camera test modal close button
  cameraTestClose.addEventListener('click', () => {
    cameraTestModal.style.display = 'none';
  });
  
  // Camera test refresh button
  cameraTestRefresh.addEventListener('click', refreshCameraTest);
  
  // Camera test confirm button
  cameraTestConfirm.addEventListener('click', confirmCameraTest);
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === cameraTestModal) {
      cameraTestModal.style.display = 'none';
    }
  });
}

// Load settings from server
function loadSettings() {
  fetch('/api/settings')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    })
    .then(settings => {
      applySettings(settings);
    })
    .catch(error => {
      console.error('Error loading settings:', error);
      showNotification('Failed to load settings, using defaults', 'warning');
      resetDefaults();
    });
}

// Apply settings to form
function applySettings(settings) {
  // Camera settings
  if (settings.camera) {
    cameraSelect.value = settings.camera.type || '0';
    ipCameraContainer.style.display = 
      cameraSelect.value === '2' ? 'block' : 'none';
    
    if (settings.camera.url) {
      ipCameraUrl.value = settings.camera.url;
    }
    
    if (settings.camera.resolution) {
      resolutionSelect.value = settings.camera.resolution;
    }
  }
  
  // Detection settings
  if (settings.detection) {
    confidenceThreshold.value = settings.detection.confidence || 0.5;
    confidenceThresholdValue.textContent = parseFloat(confidenceThreshold.value).toFixed(2);
    
    inferenceFps.value = settings.detection.fps || 5;
    inferenceFpsValue.textContent = `${inferenceFps.value} FPS`;
    
    useCoral.checked = settings.detection.use_coral === true;
  }
  
  // System settings
  if (settings.system) {
    maxDbSize.value = settings.system.max_db_size || 200;
    maxDbSizeValue.textContent = `${maxDbSize.value} MB`;
    
    autoCleanup.checked = settings.system.auto_cleanup !== false;
    
    if (settings.system.log_level) {
      logLevel.value = settings.system.log_level;
    }
  }
  
  // Advanced settings
  if (settings.advanced) {
    enableSse.checked = settings.advanced.enable_sse !== false;
    powerSaving.checked = settings.advanced.power_saving === true;
    
    if (settings.advanced.startup_action) {
      startupAction.value = settings.advanced.startup_action;
    }
  }
}

// Reset to default settings
function resetDefaults() {
  // Camera settings
  cameraSelect.value = '0';
  ipCameraContainer.style.display = 'none';
  ipCameraUrl.value = '';
  resolutionSelect.value = '640x480';
  
  // Detection settings
  confidenceThreshold.value = 0.5;
  confidenceThresholdValue.textContent = '0.5';
  inferenceFps.value = 5;
  inferenceFpsValue.textContent = '5 FPS';
  useCoral.checked = false;
  
  // System settings
  maxDbSize.value = 200;
  maxDbSizeValue.textContent = '200 MB';
  autoCleanup.checked = true;
  logLevel.value = 'info';
  
  // Advanced settings
  enableSse.checked = true;
  powerSaving.checked = false;
  startupAction.value = 'none';
  
  showNotification('Settings reset to defaults', 'info');
}

// Save settings to server
function saveSettings() {
  // Validate IP camera URL if selected
  if (cameraSelect.value === '2' && !ipCameraUrl.value.trim()) {
    showNotification('Please enter an IP camera URL', 'danger');
    ipCameraUrl.focus();
    return;
  }
  
  // Build settings object
  const settings = {
    camera: {
      type: cameraSelect.value,
      url: ipCameraUrl.value,
      resolution: resolutionSelect.value
    },
    detection: {
      confidence: parseFloat(confidenceThreshold.value),
      fps: parseInt(inferenceFps.value),
      use_coral: useCoral.checked
    },
    system: {
      max_db_size: parseInt(maxDbSize.value),
      auto_cleanup: autoCleanup.checked,
      log_level: logLevel.value
    },
    advanced: {
      enable_sse: enableSse.checked,
      power_saving: powerSaving.checked,
      startup_action: startupAction.value
    }
  };
  
  // Send settings to server
  saveSettingsBtn.disabled = true;
  saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  
  fetch('/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })
    .then(response => {
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    })
    .then(data => {
      showNotification('Settings saved successfully', 'success');
      console.log('Settings saved:', data);
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      showNotification('Failed to save settings', 'danger');
    })
    .finally(() => {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerHTML = 'Save Settings';
    });
}

// Test camera
function testCamera() {
  // Show modal
  cameraTestModal.style.display = 'block';
  
  // Load test image
  refreshCameraTest();
}

// Refresh camera test image
function refreshCameraTest() {
  const cameraType = cameraSelect.value;
  const resolution = resolutionSelect.value;
  const url = ipCameraUrl.value;
  
  // Clear current image
  cameraTestImage.src = '';
  cameraTestImage.alt = 'Loading camera test image...';
  
  // Request test image from server
  fetch(`/api/test_camera?type=${cameraType}&resolution=${resolution}&url=${encodeURIComponent(url)}&t=${Date.now()}`)
    .then(response => {
      if (!response.ok) throw new Error('Failed to get test image');
      return response.blob();
    })
    .then(blob => {
      const imageUrl = URL.createObjectURL(blob);
      cameraTestImage.src = imageUrl;
      cameraTestImage.alt = 'Camera test image';
    })
    .catch(error => {
      console.error('Error testing camera:', error);
      cameraTestImage.alt = 'Failed to load test image';
    });
}

// Confirm camera test
function confirmCameraTest() {
  cameraTestModal.style.display = 'none';
  showNotification('Camera settings confirmed', 'success');
}
