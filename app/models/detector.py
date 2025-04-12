"""
Person detector module using SSD-MobileNetV2 model
"""
import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.lite.python.interpreter import Interpreter

class PersonDetector:
    """
    Person detector class using SSD-MobileNetV2 quantized model
    """
    def __init__(self, model_path=None, confidence_threshold=0.5):
        """
        Initialize the person detector
        
        Args:
            model_path (str): Path to the TFLite model file
            confidence_threshold (float): Confidence threshold for detections
        """
        if model_path is None:
            # Default to models directory
            model_path = os.path.join(
                os.path.dirname(__file__), 
                "ssd_mobilenet_v2_quantized.tflite"
            )
        
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.person_class_id = 0  # COCO dataset: 0 is person
    
    def load_model(self):
        """
        Load the TFLite model
        """
        # Check if model file exists
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        # Load TFLite model
        self.interpreter = Interpreter(model_path=self.model_path)
        self.interpreter.allocate_tensors()
        
        # Get input and output details
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        
        # Get model input shape
        self.input_shape = self.input_details[0]['shape'][1:3]
        
        print(f"Model loaded with input shape: {self.input_shape}")
    
    def preprocess_image(self, image):
        """
        Preprocess image for inference
        
        Args:
            image (numpy.ndarray): Input image
            
        Returns:
            numpy.ndarray: Preprocessed image
        """
        # Resize to model's expected input dimensions
        resized = cv2.resize(image, (self.input_shape[1], self.input_shape[0]))
        
        # Convert to uint8 if needed by quantized model
        if self.input_details[0]['dtype'] == np.uint8:
            input_data = np.expand_dims(resized, axis=0).astype(np.uint8)
        else:
            # Convert to float and normalize to [-1,1] or [0,1] depending on model
            input_data = np.expand_dims(resized, axis=0).astype(np.float32) / 255.0
            
        return input_data
    
    def detect(self, image):
        """
        Detect persons in the image
        
        Args:
            image (numpy.ndarray): Input image
            
        Returns:
            list: List of detected boxes [x, y, w, h, confidence]
        """
        if self.interpreter is None:
            self.load_model()
            
        # Get image dimensions for scaling
        img_height, img_width = image.shape[:2]
        
        # Preprocess image
        input_data = self.preprocess_image(image)
        
        # Set input tensor
        self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
        
        # Run inference
        self.interpreter.invoke()
        
        # Get output tensors
        # Assuming standard TFLite SSD model with these outputs
        boxes = self.interpreter.get_tensor(self.output_details[0]['index'])[0]  # Bounding boxes
        classes = self.interpreter.get_tensor(self.output_details[1]['index'])[0]  # Class IDs
        scores = self.interpreter.get_tensor(self.output_details[2]['index'])[0]  # Confidence scores
        
        result_boxes = []
        
        for i in range(len(scores)):
            if scores[i] >= self.confidence_threshold and classes[i] == self.person_class_id:
                # TFLite SSD models output [y1, x1, y2, x2] normalized
                box = boxes[i]
                
                # Convert to [x, y, w, h] format and scale to image dimensions
                x = int(box[1] * img_width)
                y = int(box[0] * img_height)
                w = int((box[3] - box[1]) * img_width)
                h = int((box[2] - box[0]) * img_height)
                
                # Add confidence
                result_boxes.append([x, y, w, h, scores[i]])
        
        return result_boxes
    
    def overlay_boxes(self, image, boxes):
        """
        Draw bounding boxes on the image
        
        Args:
            image (numpy.ndarray): Input image
            boxes (list): List of boxes [x, y, w, h, confidence]
            
        Returns:
            numpy.ndarray: Image with bounding boxes
        """
        result = image.copy()
        
        # Draw person count
        person_count = len(boxes)
        cv2.putText(
            result,
            f"Persons: {person_count}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )
        
        for box in boxes:
            x, y, w, h, confidence = box
            
            # Draw bounding box
            cv2.rectangle(result, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Draw label with confidence
            label = f"Person: {confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(result, (x, y - 20), (x + label_size[0], y), (0, 255, 0), -1)
            cv2.putText(
                result,
                label,
                (x, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1
            )
            
        return result
