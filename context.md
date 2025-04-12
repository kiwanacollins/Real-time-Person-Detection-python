# Raspberry Pi 4B Person Detection System

## Hardware Specifications
- **Target Device**: Raspberry Pi 4B with 4GB RAM
- **Camera**: USB Webcam (640×480 resolution)
- **Optional**: Coral USB Accelerator for inference offloading

## System Constraints
- **Memory Usage**: Maximum 500MB RSS total
- **Storage Limit**: 200MB SQLite database
- **Performance Target**: 5 FPS maximum for inference
- **Power Management**: Use CPU governor "ondemand" for thermal optimization

## Core Components

### 1. AI Detection System
- **Model**: SSD-MobileNetV2 Quantized (TFLite ≤12MB)
- **Inference Engine**: OpenCV DNN + TensorFlow Lite
- **Performance Control**:
  - Limit to 5 FPS using `time.sleep(0.2)` between inferences
  - Memory optimization with `gc.collect()` after each frame
  - CPU affinity: `os.sched_setaffinity(0, {0,1})` (dual-core)

### 2. Backend Architecture
- **Framework**: Python 3.9+ with Flask or FastAPI
- **Camera Stream**: MJPEG server using OpenCV
- **Database**: SQLite with WAL mode for performance
- **API Endpoints**:
  - `/api/stream`: MJPEG video feed
  - `/api/count`: Person count updates via SSE (Server-Sent Events)
  - `/api/settings`: Configuration management
  - `/api/logs`: Historical data access
  - `/api/errors`: Error reporting and management
  - `/health`: System metrics for monitoring

### 3. Frontend Design
- **Technology**: Vanilla JavaScript with minimal dependencies
  - Chart.js for data visualization
  - Minimal CSS (single file, responsive design)
  - Bundle size <50KB gzipped
- **Key Features**:
  - Canvas overlay for bounding boxes
  - Real-time updates with SSE
  - Light and dark theme support
  - Responsive up to 80% viewport width

## Database Schema

```sql
CREATE TABLE detections (
    timestamp INTEGER PRIMARY KEY,
    count INTEGER,
    confidence REAL
) WITH (WAL=ON);

-- Additional tables for settings, errors, etc.
```

## Page-by-Page Implementation

### 1. Live Camera Feed (`/live`)
- Stream webcam with bounding boxes for detected persons
- Overlay confidence percentages
- Controls: Pause/Resume, Fullscreen
- Throttle inference to maintain performance

### 2. Dashboard (`/dashboard`)
- Real-time count with status indicators
- Trend chart showing last 10 minutes of data
- Status badge showing system state (Active/Warning/Error)
- Manual refresh option

### 3. Configuration (`/settings`)
- Camera selection and testing
- Detection sensitivity adjustment
- Logging preferences configuration
- Save/Cancel functionality

### 4. Logs & Reports (`/logs`)
- Paginated table of historical detections
- Date range filtering and search
- Export options (CSV, PDF)
- Server-side pagination for performance

### 5. Error Notifications (`/errors`)
- List of system errors with expandable details
- Option to clear resolved errors
- Notification badge in navigation

## Sample Code Snippets

### MJPEG Stream Implementation
```python
def generate_frames():
    while True:
        ret, frame = cap.read()
        if frame_counter % (30//5) == 0:  # 5 FPS throttle
            boxes = run_inference(frame)
        
        # Draw bounding boxes
        annotated_frame = overlay_boxes(frame, boxes)
        
        # Convert to JPEG
        _, jpeg = cv2.imencode('.jpg', annotated_frame)
        
        # Yield frame for MJPEG stream
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + 
               jpeg.tobytes() + b'\r\n')
        
        # Memory management
        gc.collect()
```

### Canvas Overlay for Frontend
```javascript
class DetectionRenderer {
  constructor(canvas, img) {
    this.ctx = canvas.getContext('2d');
    this.img = img;
    this.trackSize();
    window.addEventListener('resize', this.trackSize.bind(this));
  }

  trackSize() {
    this.ctx.canvas.width = this.img.clientWidth;
    this.ctx.canvas.height = this.img.clientHeight;
  }

  draw(boxes) {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    boxes.forEach(box => {
      const [x, y, w, h, confidence] = this.scaleBox(box);
      
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
```

## Optimization Guidelines

### Memory Conservation
- Release camera resources when not in use: `cv2.VideoCapture(0).release()`
- Use TFLite with `--lite-interpreter` flag
- Implement proper garbage collection

### Thermal Management
```bash
sudo cpufreq-set -g ondemand
echo 150000 | sudo tee /sys/devices/system/cpu/cpufreq/ondemand/sampling_rate
```

### Storage Hygiene
- SQLite VACUUM on settings save
- Log rotation with `PRAGMA auto_vacuum = INCREMENTAL`
- Limit error log entries to last 1,000 items

## Performance Benchmarks
- OpenCV MJPEG encoding: ≤30ms/frame
- TFLite inference: ≤150ms
- SSE latency: ≤1s end-to-end
- Cold boot memory usage: ≤450MB

## Implementation Sequence
1. Set up base Flask/FastAPI application with async routes
2. Implement camera wrapper with fallback test pattern
3. Build TFLite inference pipeline with frame skipping
4. Create SSE channel for count updates
5. Develop settings page with SQLite configuration backend
6. Build frontend components with vanilla JS
7. Integrate Chart.js with time-bucketed data
8. Implement export functionality with streaming response