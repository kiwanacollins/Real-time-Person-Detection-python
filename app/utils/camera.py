"""
Camera utility for Raspberry Pi 4B Person Detection System
"""
import cv2
import threading
import time
import numpy as np

class Camera:
    """
    Camera class to handle webcam operations with resource management
    """
    def __init__(self, camera_id=0, resolution=(640, 480)):
        """
        Initialize camera
        
        Args:
            camera_id (int): Camera ID (default: 0 for built-in webcam)
            resolution (tuple): Desired resolution (width, height)
        """
        self.camera_id = camera_id
        self.resolution = resolution
        self.cap = None
        self.frame = None
        self.stopped = True
        self.lock = threading.Lock()
        self.thread = None
        self.fps = 0
        self.source_type = "webcam"  # Default to webcam
        self.last_frame_time = 0
    
    def release(self):
        """Release camera resources"""
        self.stopped = True
        if self.thread:
            self.thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()
        self.cap = None
        
    def set_source(self, source):
        """
        Set camera source
        
        Args:
            source: Camera source (0 for webcam, 'picamera' for Raspberry Pi Camera, URL string for IP camera)
        """
        # Store source for later reference
        self.source = source
        
        # Stop current camera if running
        was_running = not self.stopped
        if was_running:
            self.release()
        
        # Update camera source
        self.camera_id = source
        
        # Determine source type
        if source == "picamera":
            self.source_type = "picamera"
        elif isinstance(source, str) and (source.startswith("http") or source.startswith("rtsp")):
            self.source_type = "ip_camera"
        else:
            self.source_type = "webcam"
            try:
                self.camera_id = int(source)
            except (ValueError, TypeError):
                self.camera_id = 0
                
        # Restart camera if it was running before
        if was_running:
            self.start()
    
    def set_resolution(self, width, height):
        """
        Set camera resolution
        
        Args:
            width (int): Frame width
            height (int): Frame height
        """
        self.resolution = (width, height)
        was_running = not self.stopped
        
        if was_running:
            self.release()
            self.start()
    
    def read(self):
        """
        Read current frame safely with threading lock
        
        Returns:
            numpy.ndarray: Current frame
        """
        with self.lock:
            return self.frame.copy() if self.frame is not None else None
            
    def _update(self):
        """Internal thread function to continuously update frames"""
        while not self.stopped:
            if self.cap is None or not self.cap.isOpened():
                time.sleep(0.5)
                continue
                
            ret, frame = self.cap.read()
            
            if not ret:
                time.sleep(0.5)
                continue
                
            # Resize frame to desired resolution
            if frame.shape[1::-1] != self.resolution:
                frame = cv2.resize(frame, self.resolution)
                
            # Calculate FPS
            current_time = time.time()
            if self.last_frame_time > 0:
                self.fps = 1 / (current_time - self.last_frame_time)
            self.last_frame_time = current_time
            
            # Update frame with thread lock
            with self.lock:
                self.frame = frame
    
    def start(self):
        """Start camera capture"""
        if not self.stopped:
            return  # Already running
            
        self.stopped = False
        
        # Initialize appropriate camera type
        if self.source_type == "picamera":
            try:
                # Import PiCamera if available
                from picamera.array import PiRGBArray
                from picamera import PiCamera
                
                # Initialize PiCamera
                self.picam = PiCamera()
                self.picam.resolution = self.resolution
                self.picam.framerate = 30
                self.rawCapture = PiRGBArray(self.picam, size=self.resolution)
                
                # Use OpenCV VideoCapture with PiCamera as source
                self.cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])
            except (ImportError, RuntimeError):
                # Fall back to normal webcam if PiCamera fails
                print("PiCamera import failed. Falling back to webcam.")
                self.source_type = "webcam"
                self.camera_id = 0
        
        if self.source_type == "ip_camera":
            # For IP cameras (RTSP, HTTP streams)
            self.cap = cv2.VideoCapture(self.camera_id)
        else:
            # Regular webcam
            self.cap = cv2.VideoCapture(self.camera_id)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])
            
        # Check if camera opened successfully
        if not self.cap.isOpened():
            self.stopped = True
            return False
            
        # Start thread for continuous frame capture
        self.thread = threading.Thread(target=self._update)
        self.thread.daemon = True
        self.thread.start()
        return True
        
    def get_frame_jpeg(self, quality=90):
        """
        Get current frame as JPEG bytes
        
        Args:
            quality (int): JPEG quality (0-100)
            
        Returns:
            bytes: JPEG encoded frame
        """
        frame = self.read()
        if frame is None:
            # Return a blank frame if no frame is available
            blank = np.zeros((self.resolution[1], self.resolution[0], 3), dtype=np.uint8)
            ret, jpeg = cv2.imencode('.jpg', blank)
        else:
            ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
            
        return jpeg.tobytes() if ret else None
    
    def get_info(self):
        """
        Get camera information
        
        Returns:
            dict: Dictionary with camera information
        """
        return {
            "resolution": self.resolution,
            "source": self.camera_id,
            "source_type": self.source_type,
            "fps": round(self.fps, 1),
            "running": not self.stopped
        }

    def __del__(self):
        """Ensure resources are released on destruction"""
        self.release()
