import cv2
import numpy as np
import os

video_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "app/data/videos"))
os.makedirs(video_dir, exist_ok=True)
output_path = os.path.join(video_dir, "traffic_1.mp4")

# Create a 5-second 30fps video (150 frames)
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))

for i in range(150):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw a "road"
    cv2.rectangle(frame, (100, 0), (540, 480), (50, 50, 50), -1)
    # Draw a moving "car"
    y_pos = int(i * (480 / 150))
    # It won't actually be detected by YOLO unless we use a real image of a car,
    # but YOLO might detect random shapes if thresholds are low, or we just won't detect anything.
    # To test YOLO actually detecting, we can download a real image of a car and move it,
    # but we don't have internet access to search easily for a free car image.
    # Let's just create a basic shape. 
    cv2.rectangle(frame, (300, y_pos), (360, y_pos + 100), (0, 0, 255), -1)
    
    out.write(frame)

out.release()
print(f"Created dummy video at {output_path}")
