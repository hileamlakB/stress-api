import unittest
import sys
import os
import importlib

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestDependencies(unittest.TestCase):
    """Tests to ensure all required dependencies are available."""
    
    def test_fastapi_available(self):
        """Test that FastAPI is available."""
        try:
            import fastapi
            self.assertIsNotNone(fastapi)
        except ImportError:
            self.fail("FastAPI is not installed")
    
    def test_httpx_available(self):
        """Test that HTTPX is available."""
        try:
            import httpx
            self.assertIsNotNone(httpx)
        except ImportError:
            self.fail("HTTPX is not installed")
    
    def test_uvicorn_available(self):
        """Test that Uvicorn is available."""
        try:
            import uvicorn
            self.assertIsNotNone(uvicorn)
        except ImportError:
            self.fail("Uvicorn is not installed")
    
    def test_pydantic_available(self):
        """Test that Pydantic is available."""
        try:
            import pydantic
            self.assertIsNotNone(pydantic)
        except ImportError:
            self.fail("Pydantic is not installed")
    
    def test_faker_available(self):
        """Test that Faker is available."""
        try:
            import faker
            self.assertIsNotNone(faker)
        except ImportError:
            self.fail("Faker is not installed")
    
    def test_uuid_available(self):
        """Test that UUID is available."""
        try:
            import uuid
            self.assertIsNotNone(uuid)
        except ImportError:
            self.fail("UUID module is not available")
    
    def test_json_available(self):
        """Test that JSON is available."""
        try:
            import json
            self.assertIsNotNone(json)
        except ImportError:
            self.fail("JSON module is not available")
    
    def test_asyncio_available(self):
        """Test that asyncio is available."""
        try:
            import asyncio
            self.assertIsNotNone(asyncio)
        except ImportError:
            self.fail("Asyncio module is not available")
    
    def test_datetime_available(self):
        """Test that datetime is available."""
        try:
            import datetime
            self.assertIsNotNone(datetime)
        except ImportError:
            self.fail("Datetime module is not available")
    
    def test_typing_available(self):
        """Test that typing is available."""
        try:
            import typing
            self.assertIsNotNone(typing)
        except ImportError:
            self.fail("Typing module is not available")
    
    def test_logging_available(self):
        """Test that logging is available."""
        try:
            import logging
            self.assertIsNotNone(logging)
        except ImportError:
            self.fail("Logging module is not available")


if __name__ == '__main__':
    unittest.main() 