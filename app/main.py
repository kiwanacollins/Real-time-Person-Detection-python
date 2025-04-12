"""
Main application file for Person Detection System
"""
import gc
import os
import asyncio
from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import cv2
import time
import numpy as np
from app.utils.camera import Camera
from app.models.detector import PersonDetector
from app.utils.database import Database

# Set CPU affinity to dual-core for optimization
try:
    os.sched_setaffinity(0, {0, 1})
except AttributeError:
    # Handle case where sched_setaffinity is not available (e.g., non-Linux systems)
    print("CPU affinity setting not available on this platform")

# Initialize FastAPI app
app = FastAPI(
    title="Person Detection System",
    description="Raspberry Pi 4B Person Detection System",
    version="0.1.0",
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Initialize templates
templates = Jinja2Templates(directory="app/templates")

# Initialize camera and detector
camera = Camera()
detector = PersonDetector()

# Initialize database
db = Database()

@app.on_event("startup")
async def startup_event():
    """Initialize components on startup."""
    await db.initialize()
    camera.start()
    detector.load_model()


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown."""
    camera.release()
    await db.close()


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Render the index page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/live", response_class=HTMLResponse)
async def live(request: Request):
    """Render the live camera feed page."""
    return templates.TemplateResponse("live.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Render the dashboard page with analytics."""
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/settings", response_class=HTMLResponse)
async def settings(request: Request):
    """Render the settings configuration page."""
    return templates.TemplateResponse("settings.html", {"request": request})


@app.get("/logs", response_class=HTMLResponse)
async def logs(request: Request):
    """Render the system logs page."""
    return templates.TemplateResponse("logs.html", {"request": request})


@app.get("/errors", response_class=HTMLResponse)
async def errors(request: Request):
    """Render the error logs page."""
    return templates.TemplateResponse("errors.html", {"request": request})


@app.get("/health")
async def health():
    """Return system health status."""
    return {
        "status": "ok",
        "memory_usage": f"{get_memory_usage()} MB",
        "temperature": get_cpu_temperature(),
        "storage": get_storage_usage(),
    }


@app.get("/api/settings")
async def get_settings():
    """Get current application settings."""
    settings = await db.get_settings()
    return settings


@app.post("/api/settings")
async def update_settings(settings: dict):
    """Update application settings."""
    # Update camera settings if needed
    if 'camera' in settings:
        camera_type = settings['camera'].get('type')
        camera_url = settings['camera'].get('url')
        resolution = settings['camera'].get('resolution')
        
        if resolution:
            width, height = map(int, resolution.split('x'))
            camera.set_resolution((width, height))
            
        if camera_type:
            if camera_type == '0':  # Webcam
                camera.set_source(0)
            elif camera_type == '1':  # Raspberry Pi Camera
                camera.set_source('picamera')
            elif camera_type == '2' and camera_url:  # IP Camera
                camera.set_source(camera_url)
    
    # Update detector settings
    if 'detection' in settings:
        confidence = settings['detection'].get('confidence')
        if confidence is not None:
            detector.set_confidence_threshold(float(confidence))
            
        use_coral = settings['detection'].get('use_coral')
        if use_coral is not None:
            detector.set_coral_enabled(use_coral)
    
    # Save all settings to database
    await db.save_settings(settings)
    return {"status": "ok"}


@app.get("/api/test_camera")
async def test_camera(type: str, resolution: str, url: str = None):
    """Test camera connection with specified settings."""
    test_camera = Camera()
    
    # Set resolution
    if resolution:
        try:
            width, height = map(int, resolution.split('x'))
            test_camera.set_resolution(width, height)
        except (ValueError, TypeError):
            return {"status": "error", "message": "Invalid resolution format"}
    
    # Set source based on type
    if type == '0':  # Webcam
        test_camera.set_source(0)
    elif type == '1':  # Raspberry Pi Camera
        test_camera.set_source('picamera')
    elif type == '2' and url:  # IP Camera
        test_camera.set_source(url)
    else:
        return {"status": "error", "message": "Invalid camera type or missing URL"}
    
    # Try to start camera
    success = test_camera.start()
    
    if not success:
        return {"status": "error", "message": "Failed to connect to camera"}
    
    # Get a test frame
    frame = test_camera.read()
    test_camera.release()
    
    if frame is None:
        return {"status": "error", "message": "Connected but failed to get frame"}
    
    return {"status": "ok", "resolution": f"{frame.shape[1]}x{frame.shape[0]}"}


@app.get("/api/stream")
async def video_stream():
    """Provide MJPEG video stream."""
    async def generate():
        while True:
            yield (b'--frame\r\n'
                  b'Content-Type: image/jpeg\r\n\r\n' + 
                  camera.get_frame_jpeg() + b'\r\n')
            # Throttle to maintain performance
            await asyncio.sleep(0.1)  # Max 10 FPS for stream
                  
    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/detect")
async def detect_frame():
    """Get current frame with detection results."""
    frame = camera.read()
    
    if frame is None:
        return {"error": "No frame available"}
    
    # Run detection at reduced rate (5 FPS max)
    detection_results = detector.detect(frame)
    boxes = detector.filter_detections(detection_results)
    
    # Draw bounding boxes
    annotated_frame = detector.draw_boxes(frame, boxes)
    
    # Count persons
    person_count = len(boxes)
    
    # Calculate average confidence
    avg_confidence = 0
    if person_count > 0:
        avg_confidence = sum(box[4] for box in boxes) / person_count
    
    # Store detection in database
    await db.store_detection(person_count, avg_confidence)
    
    # Memory management
    gc.collect()
    
    # Convert to JPEG
    _, jpeg = cv2.imencode('.jpg', annotated_frame)
    
    return Response(
        content=jpeg.tobytes(),
        media_type="image/jpeg"
    )


@app.get("/api/count")
async def person_count_sse():
    """
    Server-Sent Events endpoint for real-time person count updates.
    """
    async def event_generator():
        try:
            last_count = -1
            while True:
                # Get latest detection from database
                latest = await db.get_latest_detection()
                count = latest.get("count", 0) if latest else 0
                
                # Only send updates when count changes
                if count != last_count:
                    last_count = count
                    yield f"data: {{\n"
                    yield f"data: \"count\": {count},\n"
                    yield f"data: \"timestamp\": {int(time.time())},\n"
                    yield f"data: \"confidence\": {latest.get('confidence', 0) if latest else 0}\n"
                    yield f"data: }}\n\n"
                
                # Wait between checks to avoid database load
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            # Handle client disconnection
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@app.get("/api/detections/history")
async def get_detection_history(days: int = 7):
    """Get historical detection data for the specified number of days."""
    history = await db.get_detection_history(days)
    return {
        "history": history
    }


@app.get("/api/logs/system")
async def get_system_logs(limit: int = 100):
    """Get system logs with pagination."""
    logs = await db.get_system_logs(limit)
    return {
        "logs": logs
    }


@app.get("/api/logs/errors")
async def get_error_logs(limit: int = 100):
    """Get error logs with pagination."""
    logs = await db.get_error_logs(limit)
    return {
        "logs": logs
    }


@app.post("/api/logs/system")
async def add_system_log(log_data: dict):
    """Add a new system log entry."""
    await db.add_system_log(log_data.get("message"), log_data.get("level", "info"))
    return {"status": "ok"}


@app.post("/api/logs/error")
async def add_error_log(log_data: dict):
    """Add a new error log entry."""
    await db.add_error_log(log_data.get("message"), log_data.get("stack_trace"))
    return {"status": "ok"}


# Utility functions for system metrics
def get_memory_usage():
    """Get current memory usage in MB."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        return round(memory_info.rss / (1024 * 1024), 1)  # Convert to MB
    except ImportError:
        return 0.0

def get_cpu_temperature():
    """Get CPU temperature (Raspberry Pi specific)."""
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            temp = int(f.read()) / 1000.0
        return round(temp, 1)
    except (FileNotFoundError, IOError):
        return 0.0

def get_storage_usage():
    """Get storage usage information."""
    try:
        import psutil
        disk = psutil.disk_usage('/')
        total_mb = disk.total / (1024 * 1024)
        used_mb = disk.used / (1024 * 1024)
        percent = disk.percent
        return {
            "total_mb": round(total_mb, 1),
            "used_mb": round(used_mb, 1),
            "percent": percent
        }
    except ImportError:
        return {"total_mb": 0, "used_mb": 0, "percent": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
