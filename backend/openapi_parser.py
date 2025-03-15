import httpx
from typing import Dict, List, Any, Optional
from api_models import EndpointSchema, ParameterSchema, ResponseSchema
import logging
import json

logger = logging.getLogger(__name__)

class OpenAPIParser:
    """Class to parse OpenAPI specifications from a URL"""

    class OpenAPIError(Exception):
        """Exception raised for OpenAPI-related errors"""
        def __init__(self, message, status_code=None):
            self.message = message
            self.status_code = status_code
            super().__init__(self.message)

    @staticmethod
    async def fetch_openapi_spec(base_url: str) -> Dict[str, Any]:
        """Fetch OpenAPI specification from a URL"""
        try:
            # Normalize the URL
            base_url = base_url.rstrip('/')
            openapi_url = f"{base_url}/openapi.json"
            
            async with httpx.AsyncClient() as client:
                # First check if the API exists at all
                try:
                    base_response = await client.get(base_url, timeout=10.0, follow_redirects=True)
                    if base_response.status_code >= 400:
                        raise OpenAPIParser.OpenAPIError(
                            f"The target API is not accessible: HTTP {base_response.status_code}",
                            base_response.status_code
                        )
                except Exception as e:
                    raise OpenAPIParser.OpenAPIError(f"Failed to connect to the target API: {str(e)}")
                
                # Then try to get the OpenAPI schema
                response = await client.get(openapi_url, timeout=10.0)
                
                if response.status_code != 200:
                    # Try alternate OpenAPI locations
                    alternates = ["/openapi.yaml", "/swagger.json", "/swagger/v1/swagger.json", "/api-docs", "/api/v1/swagger.json"]
                    found = False
                    
                    for alt_path in alternates:
                        try:
                            alt_url = f"{base_url}{alt_path}"
                            alt_response = await client.get(alt_url, timeout=10.0)
                            if alt_response.status_code == 200:
                                if alt_path.endswith(('.json')):
                                    return alt_response.json()
                                found = True
                                break
                        except:
                            pass
                    
                    if not found:
                        raise OpenAPIParser.OpenAPIError(
                            "The target API does not appear to support OpenAPI/Swagger. "
                            "Make sure the API provides an OpenAPI schema at /openapi.json or similar paths.",
                            response.status_code
                        )
                
                # Verify the response is valid JSON and contains OpenAPI fields
                try:
                    schema = response.json()
                    
                    # Check if it's a valid OpenAPI schema
                    if not ('swagger' in schema or 'openapi' in schema):
                        raise OpenAPIParser.OpenAPIError(
                            "The response doesn't appear to be a valid OpenAPI/Swagger document. "
                            "Make sure the API is built with OpenAPI/Swagger."
                        )
                    
                    if 'paths' not in schema:
                        raise OpenAPIParser.OpenAPIError(
                            "The OpenAPI schema doesn't contain any paths. "
                            "Make sure the API has defined endpoints."
                        )
                    
                    return schema
                except json.JSONDecodeError:
                    raise OpenAPIParser.OpenAPIError("The response is not valid JSON")
                    
        except OpenAPIParser.OpenAPIError:
            # Re-raise specific OpenAPI errors
            raise
        except Exception as e:
            logger.error(f"Error fetching OpenAPI schema: {e}")
            raise OpenAPIParser.OpenAPIError(f"Error fetching OpenAPI schema: {e}")
    
    @staticmethod
    def _resolve_schema_ref(ref: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve a schema reference"""
        if not ref.startswith('#/'):  # Only handle internal references for now
            return {}
            
        parts = ref[2:].split('/')  # Remove '#/' and split into parts
        current = schema
        
        for part in parts:
            if part not in current:
                return {}
            current = current[part]
            
        # If the resolved schema also has a ref, resolve it recursively
        if isinstance(current, dict) and '$ref' in current:
            return OpenAPIParser._resolve_schema_ref(current['$ref'], schema)
            
        return current

    @staticmethod
    def _resolve_schema(schema: Dict[str, Any], full_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve a schema including all references"""
        if not schema:
            return {}
            
        if '$ref' in schema:
            return OpenAPIParser._resolve_schema_ref(schema['$ref'], full_schema)
            
        resolved = {}
        for key, value in schema.items():
            if isinstance(value, dict):
                resolved[key] = OpenAPIParser._resolve_schema(value, full_schema)
            elif isinstance(value, list):
                resolved[key] = [
                    OpenAPIParser._resolve_schema(item, full_schema) 
                    if isinstance(item, dict) else item 
                    for item in value
                ]
            else:
                resolved[key] = value
                
        return resolved

    @staticmethod
    def parse_schema(schema: Dict[str, Any]) -> List[EndpointSchema]:
        """Parse OpenAPI schema into a list of endpoints"""
        paths = schema.get('paths', {})
        endpoints = []
        
        for path, methods in paths.items():
            for method, details in methods.items():
                if method.lower() not in ['get', 'post', 'put', 'delete', 'patch']:
                    continue
                    
                parameters = []
                for param in details.get('parameters', []):
                    param_schema = OpenAPIParser._resolve_schema(param.get('schema', {}), schema)
                    parameters.append(ParameterSchema(
                        name=param['name'],
                        location=param['in'],
                        required=param.get('required', False),
                        schema=param_schema,
                        description=param.get('description')
                    ))
                
                responses = {}
                for status, response in details.get('responses', {}).items():
                    content = response.get('content', {})
                    for content_type, content_schema in content.items():
                        response_schema = OpenAPIParser._resolve_schema(content_schema.get('schema', {}), schema)
                        responses[status] = ResponseSchema(
                            status_code=status,
                            content_type=content_type,
                            schema=response_schema,
                            description=response.get('description')
                        )
                        break
                
                request_body = None
                if 'requestBody' in details:
                    content = details['requestBody'].get('content', {})
                    for content_type, content_schema in content.items():
                        request_body = OpenAPIParser._resolve_schema(content_schema.get('schema', {}), schema)
                        break
                
                endpoint = EndpointSchema(
                    path=path,
                    method=method.upper(),
                    summary=details.get('summary', ''),
                    parameters=parameters,
                    request_body=request_body,
                    responses=responses,
                    description=details.get('description')
                )
                
                endpoints.append(endpoint)
                
        return endpoints 