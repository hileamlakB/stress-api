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
            # Normalize the URL by removing trailing slashes
            base_url = base_url.rstrip('/')
            
            # If the URL ends with /docs, we need to handle it differently
            is_docs_url = base_url.endswith('/docs')
            
            # If it's a docs URL, get the actual base URL
            if is_docs_url:
                base_url = base_url[:-5]  # Remove /docs
            
            # Define common paths for OpenAPI schemas
            openapi_paths = [
                '/openapi.json',
                '/api/openapi.json',
                '/docs/openapi.json',
                '/swagger.json',
                '/swagger/v1/swagger.json',
                '/api-docs/swagger.json',
                '/api/v1/swagger.json',
                '/api/swagger.json',
            ]
            
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                logger.info(f"Testing connectivity to base URL: {base_url}")
                
                # First check if the base URL is accessible
                try:
                    base_response = await client.get(base_url)
                    if base_response.status_code >= 400:
                        logger.warning(f"Base URL returned status code {base_response.status_code}")
                except Exception as e:
                    logger.error(f"Failed to connect to base URL: {str(e)}")
                    raise OpenAPIParser.OpenAPIError(f"Failed to connect to the target API: {str(e)}")
                
                # If user provided a /docs URL, try to extract the OpenAPI URL from the HTML
                if is_docs_url:
                    docs_url = f"{base_url}/docs"
                    logger.info(f"Trying to extract OpenAPI URL from docs page: {docs_url}")
                    try:
                        docs_response = await client.get(docs_url)
                        if docs_response.status_code == 200:
                            # Look for the openapi.json URL in the HTML
                            html_content = docs_response.text
                            openapi_url = OpenAPIParser._extract_openapi_url_from_html(html_content)
                            if openapi_url:
                                # Handle relative URLs
                                if openapi_url.startswith('/'):
                                    openapi_url = f"{base_url}{openapi_url}"
                                else:
                                    openapi_url = openapi_url
                                    
                                logger.info(f"Found OpenAPI URL in docs: {openapi_url}")
                                try:
                                    openapi_response = await client.get(openapi_url)
                                    if openapi_response.status_code == 200:
                                        try:
                                            schema = openapi_response.json()
                                            if 'paths' in schema and ('swagger' in schema or 'openapi' in schema):
                                                logger.info(f"Successfully extracted valid OpenAPI schema from {openapi_url}")
                                                return schema
                                        except json.JSONDecodeError:
                                            logger.warning(f"Response from {openapi_url} is not valid JSON")
                                except Exception as e:
                                    logger.warning(f"Error fetching extracted OpenAPI URL: {str(e)}")
                    except Exception as e:
                        logger.warning(f"Error fetching docs page: {str(e)}")
                
                # Try standard FastAPI docs page if it wasn't the input URL
                if not is_docs_url:
                    docs_url = f"{base_url}/docs"
                    logger.info(f"Checking if docs page exists: {docs_url}")
                    try:
                        docs_response = await client.get(docs_url)
                        if docs_response.status_code == 200:
                            logger.info(f"Found docs page at {docs_url}")
                            # The docs page exists, look for the openapi.json URL
                            html_content = docs_response.text
                            openapi_url = OpenAPIParser._extract_openapi_url_from_html(html_content)
                            if openapi_url:
                                # Handle relative URLs
                                if openapi_url.startswith('/'):
                                    openapi_url = f"{base_url}{openapi_url}"
                                else:
                                    openapi_url = openapi_url
                                    
                                logger.info(f"Found OpenAPI URL in docs: {openapi_url}")
                                try:
                                    openapi_response = await client.get(openapi_url)
                                    if openapi_response.status_code == 200:
                                        try:
                                            schema = openapi_response.json()
                                            if 'paths' in schema and ('swagger' in schema or 'openapi' in schema):
                                                logger.info(f"Successfully extracted valid OpenAPI schema from {openapi_url}")
                                                return schema
                                        except json.JSONDecodeError:
                                            logger.warning(f"Response from {openapi_url} is not valid JSON")
                                except Exception as e:
                                    logger.warning(f"Error fetching extracted OpenAPI URL: {str(e)}")
                    except Exception as e:
                        logger.warning(f"Error checking docs page: {str(e)}")
                
                # Try all common OpenAPI paths
                for path in openapi_paths:
                    try:
                        url = f"{base_url}{path}"
                        logger.info(f"Trying to fetch OpenAPI schema from: {url}")
                        response = await client.get(url)
                        
                        if response.status_code == 200:
                            try:
                                content_type = response.headers.get('content-type', '')
                                
                                # Handle JSON content
                                if 'application/json' in content_type or path.endswith('.json'):
                                    schema = response.json()
                                    # Verify it's a valid OpenAPI schema
                                    if 'paths' in schema and ('swagger' in schema or 'openapi' in schema):
                                        logger.info(f"Successfully found OpenAPI schema at {url}")
                                        return schema
                                    else:
                                        logger.warning(f"Response from {url} is not a valid OpenAPI schema")
                            except json.JSONDecodeError:
                                logger.warning(f"Response from {url} is not valid JSON")
                    except Exception as e:
                        logger.warning(f"Error fetching from {url}: {str(e)}")
                
                # If we've tried everything and still haven't found a schema
                try:
                    # Special check for api.thebighalo.com which has a non-standard setup
                    special_case_urls = [
                        f"{base_url}/openapi",
                        f"{base_url}/api/openapi",
                        f"{base_url}/openapi.yaml",
                    ]
                    
                    for special_url in special_case_urls:
                        try:
                            logger.info(f"Trying special case URL: {special_url}")
                            response = await client.get(special_url)
                            if response.status_code == 200:
                                # Try to parse as JSON
                                try:
                                    schema = response.json()
                                    if 'paths' in schema:
                                        logger.info(f"Found special case OpenAPI schema at {special_url}")
                                        return schema
                                except:
                                    # Maybe it's YAML
                                    try:
                                        import yaml
                                        schema = yaml.safe_load(response.text)
                                        if 'paths' in schema:
                                            logger.info(f"Found special case YAML OpenAPI schema at {special_url}")
                                            return schema
                                    except:
                                        logger.warning(f"Special case URL {special_url} returned unrecognized format")
                        except Exception as e:
                            logger.warning(f"Error checking special case URL {special_url}: {str(e)}")
                            
                    # For thebighalo specifically
                    if "thebighalo.com" in base_url:
                        fallback_url = "https://api.thebighalo.com/docs"
                        logger.info(f"Trying thebighalo-specific fallback to: {fallback_url}")
                        try:
                            # For thebighalo.com we'll parse the docs page directly
                            docs_response = await client.get(fallback_url)
                            if docs_response.status_code == 200:
                                html_content = docs_response.text
                                # We'll manually extract endpoints from the HTML since this API has a non-standard setup
                                paths = OpenAPIParser._extract_endpoints_from_swagger_html(html_content)
                                if paths:
                                    logger.info("Successfully extracted endpoints from thebighalo docs HTML")
                                    return {
                                        "openapi": "3.0.0",
                                        "info": {"title": "Halo API", "version": "1.0.0"},
                                        "paths": paths
                                    }
                        except Exception as e:
                            logger.warning(f"Error with thebighalo-specific fallback: {str(e)}")
                except Exception as e:
                    logger.warning(f"Error checking special cases: {str(e)}")
                
                # If we get here, we couldn't find a valid OpenAPI schema
                if is_docs_url:
                    # Try to extract endpoints directly from HTML as a last resort
                    logger.info("Attempting to extract endpoints directly from HTML")
                    try:
                        docs_url = f"{base_url}/docs"
                        docs_response = await client.get(docs_url)
                        if docs_response.status_code == 200:
                            html_content = docs_response.text
                            paths = OpenAPIParser._extract_endpoints_from_swagger_html(html_content)
                            if paths:
                                logger.info("Successfully extracted endpoints from docs HTML")
                                return {
                                    "openapi": "3.0.0", 
                                    "info": {"title": "API", "version": "1.0.0"},
                                    "paths": paths
                                }
                    except Exception as e:
                        logger.warning(f"Failed to extract endpoints from HTML: {str(e)}")
                    
                    raise OpenAPIParser.OpenAPIError(
                        "Could not find a valid OpenAPI schema. The docs page exists but we couldn't "
                        "extract the schema URL. The API might use a non-standard OpenAPI setup."
                    )
                else:
                    # Try to extract endpoints directly from docs HTML as a last resort
                    logger.info("Attempting to extract endpoints directly from HTML")
                    try:
                        docs_url = f"{base_url}/docs"
                        docs_response = await client.get(docs_url)
                        if docs_response.status_code == 200:
                            html_content = docs_response.text
                            paths = OpenAPIParser._extract_endpoints_from_swagger_html(html_content)
                            if paths:
                                logger.info("Successfully extracted endpoints from docs HTML")
                                return {
                                    "openapi": "3.0.0", 
                                    "info": {"title": "API", "version": "1.0.0"},
                                    "paths": paths
                                }
                    except Exception as e:
                        logger.warning(f"Failed to extract endpoints from HTML: {str(e)}")
                    
                    # Get a list of endpoints we can access directly
                    accessible_endpoints = []
                    for route in ["/", "/docs", "/health", "/status", "/api"]:
                        try:
                            url = f"{base_url}{route}"
                            response = await client.get(url)
                            if response.status_code < 400:
                                accessible_endpoints.append(route)
                        except:
                            pass
                            
                    if "/docs" in accessible_endpoints:
                        raise OpenAPIParser.OpenAPIError(
                            f"The API at {base_url} appears to have a docs page at {base_url}/docs, "
                            f"but we couldn't extract a valid OpenAPI schema. Please check the docs page manually."
                        )
                    elif accessible_endpoints:
                        accessible_str = ", ".join(accessible_endpoints)
                        raise OpenAPIParser.OpenAPIError(
                            f"The API at {base_url} is accessible (found endpoints: {accessible_str}), "
                            f"but does not appear to have OpenAPI/Swagger documentation. "
                            f"Only APIs with OpenAPI documentation are supported."
                        )
                    else:
                        raise OpenAPIParser.OpenAPIError(
                            "The API does not appear to support OpenAPI/Swagger. "
                            "Make sure the API provides an OpenAPI schema at /openapi.json or similar paths."
                        )
                    
        except OpenAPIParser.OpenAPIError:
            # Re-raise specific OpenAPI errors
            raise
        except Exception as e:
            logger.error(f"Error fetching OpenAPI schema: {e}")
            raise OpenAPIParser.OpenAPIError(f"Error fetching OpenAPI schema: {e}")

    @staticmethod
    def _extract_openapi_url_from_html(html_content):
        """Extract the OpenAPI URL from the Swagger UI HTML"""
        import re
        
        # Try different patterns to match the URL in the HTML
        patterns = [
            # Most common pattern in Swagger UI
            r'(?:url:\s*["\'])([^"\']+)(?:["\'])',
            # Alternative pattern sometimes found
            r'(?:spec\s*=\s*["\'])([^"\']+)(?:["\'])',
            # Look for the API URL in a script tag
            r'<script[^>]*>\s*window\.onload.*swagger.*?url:\s*"([^"]+)"',
            # Additional pattern for swagger initialization
            r'SwaggerUIBundle\s*\(\s*\{\s*url:\s*"([^"]+)"',
        ]
        
        for pattern in patterns:
            matches = re.search(pattern, html_content, re.IGNORECASE | re.DOTALL)
            if matches:
                return matches.group(1)
                
        # If standard patterns didn't work, try to find any URL ending with openapi.json
        openapi_url_match = re.search(r'["\'](/[^"\']*openapi\.json)["\']', html_content)
        if openapi_url_match:
            return openapi_url_match.group(1)
            
        # More aggressive search for any openapi-related URL
        openapi_url_match = re.search(r'["\']([^"\']*openapi[^"\']*)["\']', html_content)
        if openapi_url_match:
            return openapi_url_match.group(1)
            
        return None

    @staticmethod
    def _extract_endpoints_from_swagger_html(html_content):
        """Extract endpoints directly from Swagger UI HTML as a fallback"""
        import re
        
        paths = {}
        
        # Find all endpoint sections
        endpoint_sections = re.findall(r'<div class="opblock[^>]*>.*?</div>\s*</div>\s*</div>', html_content, re.DOTALL)
        
        if not endpoint_sections:
            # Try another pattern for different Swagger UI versions
            endpoint_sections = re.findall(r'<div class="opblock[^>]*>.*?</div>\s*</div>', html_content, re.DOTALL)
        
        for section in endpoint_sections:
            # Extract method and path
            method_match = re.search(r'<span class="opblock-summary-method">(.*?)</span>', section)
            path_match = re.search(r'<span class="opblock-summary-path[^"]*"[^>]*>(.*?)</span>', section)
            
            if not path_match:
                # Try alternative pattern
                path_match = re.search(r'<span[^>]*>(\/[^<]+)<', section)
            
            if method_match and path_match:
                method = method_match.group(1).lower()
                path = path_match.group(1)
                
                # Extract summary if available
                summary = ""
                summary_match = re.search(r'<div[^>]*class="opblock-summary-description"[^>]*>(.*?)</div>', section)
                if summary_match:
                    summary = summary_match.group(1).strip()
                
                # Create path if it doesn't exist
                if path not in paths:
                    paths[path] = {}
                    
                # Add method to path
                paths[path][method] = {
                    "summary": summary,
                    "description": "",
                    "parameters": [],
                    "responses": {"200": {"description": "Successful response"}}
                }
        
        return paths

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
    def parse_endpoints(schema: Dict[str, Any]) -> List[EndpointSchema]:
        """Extract endpoints from the OpenAPI schema"""
        endpoints = []
        
        paths = schema.get('paths', {})
        for path, path_item in paths.items():
            # Skip if path_item is not a dictionary
            if not isinstance(path_item, dict):
                continue
                
            for method, operation in path_item.items():
                # Skip if not an HTTP method or operation is not a dictionary
                if method not in ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] or not isinstance(operation, dict):
                    continue
                
                try:
                    # Extract endpoint details
                    summary = operation.get('summary', '')
                    description = operation.get('description', '')
                    
                    # Parse parameters (path, query, header, cookie)
                    parameters = []
                    for param in operation.get('parameters', []):
                        # Skip if param is not a dictionary or if it's a reference
                        if not isinstance(param, dict):
                            continue
                            
                        # Handle parameter references
                        if '$ref' in param:
                            param = OpenAPIParser._resolve_schema_ref(param['$ref'], schema)
                            
                        param_schema = {}
                        if 'schema' in param:
                            param_schema = param['schema']
                            # Handle schema references
                            if '$ref' in param_schema:
                                param_schema = OpenAPIParser._resolve_schema_ref(param_schema['$ref'], schema)
                        
                        # Create parameter schema
                        parameter = ParameterSchema(
                            name=param.get('name', ''),
                            location=param.get('in', ''),
                            required=param.get('required', False),
                            param_schema=param_schema,
                            description=param.get('description', '')
                        )
                        parameters.append(parameter)
                    
                    # Parse request body
                    request_body = None
                    if 'requestBody' in operation:
                        request_body_obj = operation['requestBody']
                        
                        # Handle request body references
                        if '$ref' in request_body_obj:
                            request_body_obj = OpenAPIParser._resolve_schema_ref(request_body_obj['$ref'], schema)
                            
                        # Extract content types and schemas
                        if 'content' in request_body_obj:
                            content = request_body_obj['content']
                            # Usually we'd expect application/json, but let's handle other formats too
                            for content_type, content_schema in content.items():
                                if 'schema' in content_schema:
                                    schema = content_schema['schema']
                                    # Handle schema references
                                    if '$ref' in schema:
                                        schema = OpenAPIParser._resolve_schema_ref(schema['$ref'], schema)
                                    request_body = schema
                                    break
                    
                    # Parse responses
                    responses = {}
                    for status_code, response_obj in operation.get('responses', {}).items():
                        # Handle response references
                        if '$ref' in response_obj:
                            response_obj = OpenAPIParser._resolve_schema_ref(response_obj['$ref'], schema)
                            
                        # Skip if response_obj is not a dictionary
                        if not isinstance(response_obj, dict):
                            continue
                            
                        # Extract content types and schemas
                        for content_type, content_schema in response_obj.get('content', {}).items():
                            if 'schema' in content_schema:
                                schema = content_schema['schema']
                                # Handle schema references
                                if '$ref' in schema:
                                    schema = OpenAPIParser._resolve_schema_ref(schema['$ref'], schema)
                                
                                # Create response schema
                                response = ResponseSchema(
                                    status_code=status_code,
                                    content_type=content_type,
                                    response_schema=schema,
                                    description=response_obj.get('description', '')
                                )
                                responses[status_code] = response
                                break
                        
                        # If no content type was found, create a response without a schema
                        if status_code not in responses:
                            response = ResponseSchema(
                                status_code=status_code,
                                content_type="",
                                response_schema={},
                                description=response_obj.get('description', '')
                            )
                            responses[status_code] = response
                    
                    # Create endpoint schema
                    endpoint = EndpointSchema(
                        path=path,
                        method=method.upper(),
                        summary=summary,
                        description=description,
                        parameters=parameters,
                        request_body=request_body,
                        responses=responses
                    )
                    endpoints.append(endpoint)
                except Exception as e:
                    logger.error(f"Error parsing endpoint {method.upper()} {path}: {e}")
                    # Continue with other endpoints instead of failing completely
                    continue
        
        # Return endpoints sorted by path and method for consistency
        return sorted(endpoints, key=lambda e: (e.path, e.method))

    @classmethod
    async def get_endpoints(cls, url: str) -> List[EndpointSchema]:
        """Fetch and parse OpenAPI endpoints from a URL"""
        schema = await cls.fetch_openapi_spec(url)
        return cls.parse_endpoints(schema)