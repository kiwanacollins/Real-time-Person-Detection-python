# Raspberry Pi 4B Person Detection System

A real-time person detection system designed for Raspberry Pi 4B, with web interface for monitoring and configuration.

## Overview

This project provides a lightweight yet powerful person detection system that runs efficiently on Raspberry Pi 4B hardware. It features a responsive web interface for monitoring detections in real-time, reviewing historical data, and configuring system parameters.

## Features

- **Real-time detection** with adjustable confidence thresholds
- **Live camera feed** with bounding box overlays
- **Detection dashboard** with statistics and visualizations
- **Historical logs** with search, filtering, and export options
- **Error monitoring** and system status information
- **Configuration interface** for camera and detection settings
- **Dark/light theme** support for the web interface

## Hardware Requirements

- Raspberry Pi 4B (2GB+ RAM recommended)
- Camera module or USB webcam
- Optional: Coral USB Accelerator for improved inference speed

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/raspberry-pi-person-detection.git
cd raspberry-pi-person-detection
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python -m app.main
```

4. Open a web browser and navigate to:
```
http://localhost:8000
```

## Configuration

The system can be configured through the web interface under Settings, including:

- Camera selection (built-in, USB, or IP camera)
- Detection sensitivity and inference FPS
- Database size limits and auto-cleanup options
- Log level and system preferences

## Project Structure

```
├── app/
│   ├── models/        # Detection models
│   ├── static/        # Web assets (CSS, JavaScript)
│   ├── templates/     # HTML templates
│   └── utils/         # Utility modules
├── requirements.txt   # Dependencies
└── README.md          # Project documentation
```

## License

[MIT License](LICENSE)

## Acknowledgements

- TensorFlow Lite for providing the underlying detection models
- OpenCV for camera handling and image processing
- FastAPI/Flask for the web framework
