import unittest
import asyncio
import json
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from openapi_parser import OpenAPIParser


class TestOpenAPIParser(unittest.TestCase):
    def setUp(self):
        # Sample OpenAPI schema for testing
        self.sample_schema = {
            "openapi": "3.0.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "get": {
                        "summary": "Get all users",
                        "parameters": [
                            {
                                "name": "limit",
                                "in": "query",
                                "required": False,
                                "schema": {
                                    "type": "integer"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "List of users",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/User"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "post": {
                        "summary": "Create a user",
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/User"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "201": {
                                "description": "User created",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/User"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer"
                            },
                            "name": {
                                "type": "string"
                            },
                            "email": {
                                "type": "string",
                                "format": "email"
                            }
                        },
                        "required": ["name", "email"]
                    }
                }
            }
        }
        
    @patch('httpx.AsyncClient')
    async def test_fetch_openapi_spec_success(self, mock_client):
        """Test successfully fetching OpenAPI spec"""
        # Setup mock client
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.sample_schema
        
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        # Execute
        result = await OpenAPIParser.fetch_openapi_spec("https://example.com")
        
        # Assert
        self.assertEqual(result, self.sample_schema)
        mock_client_instance.get.assert_called_with("https://example.com/openapi.json", timeout=10.0)
        
    @patch('httpx.AsyncClient')
    async def test_fetch_openapi_spec_failure(self, mock_client):
        """Test failing to fetch OpenAPI spec"""
        # Setup mock client
        mock_response = MagicMock()
        mock_response.status_code = 404
        
        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance
        
        # Execute and assert
        with self.assertRaises(OpenAPIParser.OpenAPIError):
            await OpenAPIParser.fetch_openapi_spec("https://example.com")
            
    def test_parse_schema(self):
        """Test parsing an OpenAPI schema into endpoints"""
        # Execute
        endpoints = OpenAPIParser.parse_schema(self.sample_schema)
        
        # Assert
        self.assertEqual(len(endpoints), 2)
        
        # Check first endpoint (GET /users)
        self.assertEqual(endpoints[0].path, "/users")
        self.assertEqual(endpoints[0].method, "GET")
        self.assertEqual(endpoints[0].summary, "Get all users")
        self.assertEqual(len(endpoints[0].parameters), 1)
        self.assertEqual(endpoints[0].parameters[0].name, "limit")
        self.assertEqual(endpoints[0].parameters[0].location, "query")
        self.assertFalse(endpoints[0].parameters[0].required)
        
        # Check second endpoint (POST /users)
        self.assertEqual(endpoints[1].path, "/users")
        self.assertEqual(endpoints[1].method, "POST")
        self.assertEqual(endpoints[1].summary, "Create a user")
        self.assertIsNotNone(endpoints[1].request_body)
        
    def test_resolve_schema_ref(self):
        """Test resolving schema references"""
        # Setup
        ref = "#/components/schemas/User"
        
        # Execute
        resolved = OpenAPIParser._resolve_schema_ref(ref, self.sample_schema)
        
        # Assert
        self.assertEqual(resolved["type"], "object")
        self.assertIn("properties", resolved)
        self.assertIn("id", resolved["properties"])
        self.assertIn("name", resolved["properties"])
        self.assertIn("email", resolved["properties"])
        self.assertEqual(resolved["properties"]["email"]["format"], "email")
        

# Helper to run async tests
def run_async_test(coro):
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


if __name__ == '__main__':
    unittest.main() 