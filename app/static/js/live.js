/**
 * Live Camera Feed JavaScript for Person Detection System
 * Manages the live video stream, detection overlay, and camera controls
 */

// DOM elements
const cameraFeed = document.getElementById('camera-feed');
const cameraOverlay = document.getElementById('camera-overlay');
const cameraContainer = document.getElementById('camera-container');
const pauseBtn = document.getElementById('pause-btn');
const pauseText = document.getElementById('pause-text');
const pauseIcon = pauseBtn.querySelector('.pause-icon');
const playIcon = pauseBtn.querySelector('.play-icon');
const snapshotBtn = document.getElementById('snapshot-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fpsIndicator = document.getElementById('fps-indicator');
const currentCount = document.getElementById('current-count');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceText = document.getElementById('confidence-text');
const detectionTime = document.getElementById('detection-time');

// State variables
let isPaused = false;
let isFullscreen = false;
let detectionRenderer = null;
let lastDetection = {
  count: 0,
  confidence: 0,
  time: 0,
  boxes: []
};
let eventSource = null;
let frameRate = 5;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initCameraStream();
  initCameraControls();
  initDetectionRenderer();
  initEventSource();
});

// Initialize camera stream
function initCameraStream() {
  // Set up error handling
  cameraFeed.onerror = () => {
    showNotification('Error loading camera feed', 'danger');
  };
  
  // Set camera feed source
  cameraFeed.src = '/api/stream';
}

// Initialize camera controls
function initCameraControls() {
  // Pause button
  pauseBtn.addEventListener('click', togglePause);
  
  // Snapshot button
  snapshotBtn.addEventListener('click', takeSnapshot);
  
  // Fullscreen button
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

// Toggle pause/play
function togglePause() {
  isPaused = !isPaused;
  
  if (isPaused) {
    // Pause stream
    cameraFeed.style.opacity = '0.7';
    pauseText.textContent = 'Resume';
    pauseIcon.style.display = 'none';
    playIcon.style.display = 'inline-block';
    
    // Stop event source
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  } else {
    // Resume stream
    cameraFeed.style.opacity = '1';
    pauseText.textContent = 'Pause';
    pauseIcon.style.display = 'inline-block';
    playIcon.style.display = 'none';
    
    // Restart event source
    initEventSource();
  }
}

// Take a snapshot of the current frame
function takeSnapshot() {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = cameraFeed.naturalWidth || 640;
  canvas.height = cameraFeed.naturalHeight || 480;
  
  // Draw the current frame to the canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
  
  // Draw detection boxes if available
  if (lastDetection.boxes.length > 0) {
    drawBoxesOnCanvas(ctx, lastDetection.boxes, canvas.width, canvas.height);
  }
  
  // Convert to data URL
  try {
    const dataURL = canvas.toDataURL('image/png');
    
    // Create a download link
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `person-detection-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.png`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Snapshot saved', 'success');
  } catch (e) {
    console.error('Error taking snapshot:', e);
    showNotification('Failed to take snapshot', 'danger');
  }
}

// Draw detection boxes on canvas for snapshot
function drawBoxesOnCanvas(ctx, boxes, width, height) {
  // Scale boxes to actual canvas size
  const scaleX = width / cameraOverlay.width;
  const scaleY = height / cameraOverlay.height;
  
  // Draw boxes
  ctx.strokeStyle = '#FF3B30';
  ctx.lineWidth = 2 * Math.max(scaleX, scaleY);
  ctx.fillStyle = '#FF3B30';
  ctx.font = `${14 * Math.max(scaleX, scaleY)}px Arial`;
  
  boxes.forEach(box => {
    const [x, y, w, h, confidence] = box;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledW = w * scaleX;
    const scaledH = h * scaleY;
    
    // Draw rectangle
    ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);
    
    // Draw label background
    ctx.fillRect(scaledX, scaledY - 20 * scaleY, 120 * scaleX, 20 * scaleY);
    
    // Draw label text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Person: ${(confidence*100).toFixed(0)}%`, scaledX + 5 * scaleX, scaledY - 5 * scaleY);
    ctx.fillStyle = '#FF3B30';
  });
}

// Toggle fullscreen mode
function toggleFullscreen() {
  if (!isFullscreen) {
    if (cameraContainer.requestFullscreen) {
      cameraContainer.requestFullscreen();
    } else if (cameraContainer.mozRequestFullScreen) { /* Firefox */
      cameraContainer.mozRequestFullScreen();
    } else if (cameraContainer.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
      cameraContainer.webkitRequestFullscreen();
    } else if (cameraContainer.msRequestFullscreen) { /* IE/Edge */
      cameraContainer.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
      document.msExitFullscreen();
    }
  }
}

// Fullscreen change event
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
  isFullscreen = document.fullscreenElement || 
                document.webkitFullscreenElement || 
                document.mozFullScreenElement || 
                document.msFullscreenElement;
}

// Initialize detection overlay
function initDetectionRenderer() {
  detectionRenderer = new DetectionRenderer(cameraOverlay, cameraFeed);
  
  // Add resize handler
  window.addEventListener('resize', () => {
    detectionRenderer.trackSize();
    if (lastDetection.boxes.length > 0) {
      detectionRenderer.draw(lastDetection.boxes);
    }
  });
}

// Detection renderer class
class DetectionRenderer {
  constructor(canvas, img) {
    this.ctx = canvas.getContext('2d');
    this.img = img;
    this.trackSize();
  }

  trackSize() {
    this.ctx.canvas.width = this.img.clientWidth;
    this.ctx.canvas.height = this.img.clientHeight;
  }

  draw(boxes) {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    boxes.forEach(box => {
      const [x, y, w, h, confidence] = box;
      
      // Draw bounding box
      this.ctx.strokeStyle = '#FF3B30';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // Draw label
      this.ctx.fillStyle = '#FF3B30';
      this.ctx.fillRect(x, y - 20, 120, 20);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(`Person: ${(confidence*100).toFixed(0)}%`, x + 5, y - 5);
    });
  }
}

// Initialize Server-Sent Events for real-time updates
function initEventSource() {
  if (isPaused || eventSource) return;
  
  eventSource = new EventSource('/api/count');
  
  // Connection opened
  eventSource.onopen = (event) => {
    console.log('SSE connection established');
  };
  
  // Listen for detection events
  eventSource.addEventListener('detection', (event) => {
    const data = JSON.parse(event.data);
    updateDetectionDisplay(data);
  });
  
  // Listen for frame rate updates
  eventSource.addEventListener('fps', (event) => {
    frameRate = parseFloat(event.data);
    fpsIndicator.textContent = `${frameRate} FPS`;
  });
  
  // Error handling
  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      setTimeout(initEventSource, 5000); // Try to reconnect after 5 seconds
    }
  };
}

// Update the detection display with new data
function updateDetectionDisplay(data) {
  if (isPaused) return;
  
  lastDetection = data;
  
  // Update person count
  currentCount.textContent = data.count;
  
  // Update confidence bar
  const confidence = data.confidence || 0;
  confidenceBar.style.width = `${confidence * 100}%`;
  confidenceText.textContent = `${(confidence * 100).toFixed(0)}%`;
  
  // Update detection time
  detectionTime.textContent = `${data.time} ms`;
  
  // Update overlay
  if (detectionRenderer && data.boxes) {
    detectionRenderer.draw(data.boxes);
  }
}
