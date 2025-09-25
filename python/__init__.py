"""
Python package for image processing and analysis
"""

__version__ = "1.0.0"
__author__ = "Your Name"

# Import main functions
try:
    from .forgery_detector import detect_forgery
    __all__ = ['detect_forgery']
except ImportError as e:
    print(f"Warning: Could not import forgery_detector: {e}")
    __all__ = []