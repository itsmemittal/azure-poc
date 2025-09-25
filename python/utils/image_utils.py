from PIL import Image
import cv2
import numpy as np

def resize_image(image_path, width, height):
    """Resize image to specified dimensions"""
    try:
        image = Image.open(image_path)
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        return resized
    except Exception as e:
        raise Exception(f"Failed to resize image: {str(e)}")

def convert_format(image_path, output_format):
    """Convert image to specified format"""
    try:
        image = Image.open(image_path)
        if output_format.upper() == 'JPEG':
            image = image.convert('RGB')
        return image
    except Exception as e:
        raise Exception(f"Failed to convert image: {str(e)}")

def get_image_info(image_path):
    """Get basic image information"""
    try:
        image = Image.open(image_path)
        return {
            "width": image.width,
            "height": image.height,
            "format": image.format,
            "mode": image.mode,
            "size": image.size
        }
    except Exception as e:
        raise Exception(f"Failed to get image info: {str(e)}")