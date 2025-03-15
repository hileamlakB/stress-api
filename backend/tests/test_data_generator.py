import unittest
import sys
import os
import re
from unittest.mock import patch, MagicMock

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from data_generator import RequestDataGenerator


class TestRequestDataGenerator(unittest.TestCase):
    def setUp(self):
        self.generator = RequestDataGenerator()
        
    def test_generate_primitive_string(self):
        """Test generating primitive string values"""
        # Execute
        result = self.generator.generate_primitive("string")
        
        # Assert
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)
        
    def test_generate_primitive_integer(self):
        """Test generating primitive integer values"""
        # Execute
        result = self.generator.generate_primitive("integer")
        
        # Assert
        self.assertIsInstance(result, int)
        self.assertGreaterEqual(result, 1)
        self.assertLessEqual(result, 100)
        
    def test_generate_primitive_number(self):
        """Test generating primitive number values"""
        # Execute
        result = self.generator.generate_primitive("number")
        
        # Assert
        self.assertIsInstance(result, int)  # Faker returns int for random_number
        
    def test_generate_primitive_boolean(self):
        """Test generating primitive boolean values"""
        # Execute
        result = self.generator.generate_primitive("boolean")
        
        # Assert
        self.assertIsInstance(result, bool)
        
    def test_generate_primitive_with_format_email(self):
        """Test generating email values"""
        # Execute
        result = self.generator.generate_primitive("string", "email")
        
        # Assert
        self.assertIsInstance(result, str)
        # Simple regex to validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        self.assertTrue(re.match(email_pattern, result))
        
    def test_generate_primitive_with_enum(self):
        """Test generating values from an enum"""
        # Setup
        enum = ["red", "green", "blue"]
        
        # Execute
        result = self.generator.generate_primitive("string", enum=enum)
        
        # Assert
        self.assertIn(result, enum)
        
    def test_generate_array(self):
        """Test generating array data"""
        # Setup
        schema = {
            "type": "array",
            "items": {
                "type": "string"
            }
        }
        
        # Execute
        result = self.generator.generate_array(schema)
        
        # Assert
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        for item in result:
            self.assertIsInstance(item, str)
            
    def test_generate_object(self):
        """Test generating object data"""
        # Setup
        schema = {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string"
                },
                "age": {
                    "type": "integer"
                },
                "email": {
                    "type": "string",
                    "format": "email"
                }
            },
            "required": ["name", "email"]
        }
        
        # Execute
        result = self.generator.generate_object(schema)
        
        # Assert
        self.assertIsInstance(result, dict)
        # Required properties should be present
        self.assertIn("name", result)
        self.assertIn("email", result)
        self.assertIsInstance(result["name"], str)
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        self.assertTrue(re.match(email_pattern, result["email"]))
        
    def test_generate_request_data(self):
        """Test generating complete request data"""
        # Setup
        schema = {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string"
                        },
                        "email": {
                            "type": "string",
                            "format": "email"
                        },
                        "roles": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": ["admin", "user", "guest"]
                            }
                        }
                    },
                    "required": ["name", "email"]
                },
                "timestamp": {
                    "type": "string",
                    "format": "date-time"
                }
            },
            "required": ["user"]
        }
        
        # Execute
        result = self.generator.generate_request_data(schema)
        
        # Assert
        self.assertIsInstance(result, dict)
        self.assertIn("user", result)
        self.assertIsInstance(result["user"], dict)
        self.assertIn("name", result["user"])
        self.assertIn("email", result["user"])
        # Email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        self.assertTrue(re.match(email_pattern, result["user"]["email"]))
        
        # If roles were generated, they should be valid
        if "roles" in result["user"]:
            self.assertIsInstance(result["user"]["roles"], list)
            for role in result["user"]["roles"]:
                self.assertIn(role, ["admin", "user", "guest"])


if __name__ == '__main__':
    unittest.main() 