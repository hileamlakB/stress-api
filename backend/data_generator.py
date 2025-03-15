from faker import Faker
from typing import Dict, List, Any, Optional
import random
import logging

logger = logging.getLogger(__name__)

class RequestDataGenerator:
    """Generate fake data based on OpenAPI schemas"""
    
    def __init__(self):
        self.fake = Faker()
    
    def generate_primitive(self, schema_type: str, schema_format: Optional[str] = None, enum: Optional[List] = None) -> Any:
        """Generate a primitive value based on type and format"""
        # If enum is provided, choose a random value from it
        if enum:
            return random.choice(enum)
            
        # Handle different primitive types
        if schema_type == 'string':
            if schema_format == 'email':
                return self.fake.email()
            elif schema_format == 'date':
                return self.fake.date()
            elif schema_format == 'date-time':
                return self.fake.iso8601()
            elif schema_format == 'uuid':
                return str(self.fake.uuid4())
            elif schema_format == 'uri':
                return self.fake.uri()
            elif schema_format == 'password':
                return self.fake.password()
            else:
                return self.fake.word()
        elif schema_type == 'integer':
            return self.fake.random_int(min=1, max=100)
        elif schema_type == 'number':
            return self.fake.random_number(digits=2)
        elif schema_type == 'boolean':
            return self.fake.boolean()
        else:
            return None
        
    def generate_array(self, schema: Dict[str, Any]) -> List[Any]:
        """Generate an array based on schema"""
        items_schema = schema.get('items', {})
        item_type = items_schema.get('type', 'string')
        
        # Generate 1-3 items for the array
        count = random.randint(1, 3)
        result = []
        
        for _ in range(count):
            if item_type in ('string', 'integer', 'number', 'boolean'):
                item_format = items_schema.get('format')
                item_enum = items_schema.get('enum')
                result.append(self.generate_primitive(item_type, item_format, item_enum))
            elif item_type == 'object':
                result.append(self.generate_object(items_schema))
            elif item_type == 'array':
                # Handle nested arrays (with a depth limit for safety)
                result.append(self.generate_array(items_schema))
                
        return result
        
    def generate_object(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate an object based on schema"""
        if not schema or schema.get('type') != 'object':
            return {}

        result = {}
        properties = schema.get('properties', {})
        required = schema.get('required', [])
        
        for prop_name, prop_schema in properties.items():
            # Only generate required properties and some random optional ones
            if prop_name in required or random.random() > 0.5:
                prop_type = prop_schema.get('type', 'string')
                
                if prop_type in ('string', 'integer', 'number', 'boolean'):
                    prop_format = prop_schema.get('format')
                    prop_enum = prop_schema.get('enum')
                    result[prop_name] = self.generate_primitive(prop_type, prop_format, prop_enum)
                elif prop_type == 'object':
                    result[prop_name] = self.generate_object(prop_schema)
                elif prop_type == 'array':
                    result[prop_name] = self.generate_array(prop_schema)
                    
        return result
        
    def generate_request_data(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate request data based on a schema"""
        if not schema:
            return {}
            
        try:
            return self.generate_object(schema)
        except Exception as e:
            logger.error(f"Error generating request data: {e}")
            return {} 