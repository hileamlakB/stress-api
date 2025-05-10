from fastapi import FastAPI, HTTPException, Query, Path, Body, Header, Depends
from typing import Optional, List
import random
import time
from datetime import datetime
import psutil
from pydantic import BaseModel, Field

from models import (
    UserRole, User, UserCreate, UserResponse, UsersListResponse,
    Product, ProductCreate, ProductResponse, ProductSearchParams, ProductSearchResponse,
    Order, OrderCreate, OrderResponse, OrderStatusResponse, OrderStatus,
    DelayResponse, LoadTestParams, LoadTestResponse,
    ErrorResponse
)

app = FastAPI(
    title="Test API for Stress Testing",
    description="A comprehensive test API with various endpoints to validate stress testing scenarios",
    version="1.0.0"
)

def get_current_time():
    return datetime.now()

# Create simplified versions of our models for stress testing
class SimpleProductCreate(BaseModel):
    name: str = Field("Test Product", description="Product name")
    price: float = Field(19.99, description="Product price")
    description: Optional[str] = Field("A test product description", description="Product description")
    tags: List[str] = Field(default_factory=lambda: ["test", "product"], description="Product tags")
    sku: Optional[str] = Field("TEST1234", description="Product SKU")

class SimpleOrderItem(BaseModel):
    product_id: int = Field(1, description="Product ID")
    quantity: int = Field(1, description="Quantity")
    unit_price: float = Field(19.99, description="Unit price")

class SimpleOrderCreate(BaseModel):
    user_id: int = Field(1, description="User ID")
    items: List[SimpleOrderItem] = Field(
        default_factory=lambda: [SimpleOrderItem()], 
        description="Order items"
    )
    shipping_address: str = Field(
        "123 Test Street, Test City, 12345",
        description="Shipping address"
    )

def verify_api_key(api_key: str = Header(None, description="API key for authentication")):
    # If api_key is None, we'll accept the request anyway for stress testing purposes
    if api_key is not None and api_key != "test_key":
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return api_key

# Basic Endpoints
@app.get("/", tags=["general"])
async def root():
    """
    Simple endpoint that returns a welcome message.
    """
    return {"message": "Welcome to the Test API"}

# User Management Endpoints
@app.post("/users/", 
    tags=["users"], 
    response_model=UserResponse,
    responses={
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse}
    }
)
async def create_user(user: Optional[UserCreate] = Body(
    None,
    example={
        "username": "testuser",
        "email": "test@example.com",
        "role": "user",
        "password": "password123"
    },
    description="User creation data. If not provided, default values will be used."
)):
    """
    Create a new user in the system.
    
    If no user data is provided, default test values will be used.
    """
    # Use default values if none provided
    if user is None:
        user = UserCreate(
            username="testuser",
            email="test@example.com",
            role=UserRole.USER,
            password="password123"
        )
    
    if random.random() < 0.1:  # 10% chance of conflict
        raise HTTPException(status_code=409, detail="Username already exists")
    
    new_user = User(
        id=random.randint(1, 10000),
        username=user.username,
        email=user.email,
        role=user.role,
        active=True,
        created_at=get_current_time()
    )
    return UserResponse(data=new_user)

@app.get("/users/{user_id}", 
    tags=["users"], 
    response_model=UserResponse,
    responses={404: {"model": ErrorResponse}}
)
async def get_user(
    user_id: int = Path(..., ge=1, description="User ID to retrieve"),
    include_orders: bool = Query(False, description="Whether to include orders in the response")
):
    """
    Retrieve user information by ID.
    """
    if user_id % 5 == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = User(
        id=user_id,
        username=f"user_{user_id}",
        email=f"user_{user_id}@example.com",
        role=random.choice(list(UserRole)),
        active=True,
        created_at=get_current_time()
    )
    
    return UserResponse(data=user)

# Product Management Endpoints
@app.post("/products/", 
    tags=["products"], 
    response_model=ProductResponse
)
async def create_product(product: Optional[SimpleProductCreate] = Body(
    None,
    example={
        "name": "Test Product",
        "price": 19.99,
        "description": "A test product description",
        "tags": ["test", "product"],
        "sku": "TEST1234"
    },
    description="Product creation data. If not provided, default values will be used."
)):
    """
    Create a new product in the catalog.
    
    For stress testing, a simplified product model is used with default values.
    If no product data is provided, default test values will be used.
    """
    # Use default values if none provided
    if product is None:
        product = SimpleProductCreate()
    
    new_product = Product(
        id=random.randint(1000, 9999),
        name=product.name,
        price=product.price,
        description=product.description,
        tags=product.tags,
        in_stock=True,
        created_at=get_current_time(),
        image_url=None
    )
    return ProductResponse(data=new_product)

@app.get("/products/search", 
    tags=["products"], 
    response_model=ProductSearchResponse
)
async def search_products(params: ProductSearchParams = Depends()):
    """
    Search products with various filters.
    """
    # Simulate processing time based on complexity of query
    time.sleep(0.2)  # Reduced delay for stress testing
    
    products = [
        Product(
            id=i+1,  # Start from 1 instead of 0
            name=f"Product {i+1}",
            price=random.uniform(10, 1000),
            tags=random.sample(["electronics", "clothing", "books", "food"], 2),
            in_stock=True,
            created_at=get_current_time(),
            description=f"Description for product {i+1}"
        )
        for i in range(params.limit)
    ]
    
    return ProductSearchResponse(
        data=products,
        total=len(products),
        page=params.page,
        page_size=params.limit
    )

# Order Management Endpoints
@app.post("/orders/", 
    tags=["orders"], 
    response_model=OrderResponse,
    responses={503: {"model": ErrorResponse}}
)
async def create_order(order: Optional[SimpleOrderCreate] = Body(
    None,
    example={
        "user_id": 1,
        "items": [
            {
                "product_id": 1,
                "quantity": 1,
                "unit_price": 19.99
            }
        ],
        "shipping_address": "123 Test Street, Test City, 12345"
    },
    description="Order creation data. If not provided, default values will be used."
)):
    """
    Create a new order in the system.
    
    For stress testing, a simplified order model is used with default values.
    If no order data is provided, default test values will be used.
    """
    # Use default values if none provided
    if order is None:
        order = SimpleOrderCreate()
    
    if random.random() < 0.2:  # 20% chance of failure
        raise HTTPException(
            status_code=503, 
            detail="Order processing system temporarily unavailable"
        )
    
    # Calculate total amount from items
    total_amount = sum(item.quantity * item.unit_price for item in order.items)
    
    new_order = Order(
        id=f"ORD-{random.randint(100000, 999999)}",
        user_id=order.user_id,
        items=order.items,
        total_amount=total_amount,
        status="pending",
        created_at=get_current_time(),
        updated_at=get_current_time(),
        shipping_address=order.shipping_address
    )
    
    return OrderResponse(data=new_order)

@app.get("/orders/{order_id}/status", 
    tags=["orders"], 
    response_model=OrderStatusResponse
)
async def get_order_status(
    order_id: str = Path(..., description="Order ID to check status for"),
    user_id: int = Query(1, ge=1, description="ID of the user who placed the order")
):
    """
    Check the status of an existing order.
    
    For stress testing, any order ID format is accepted, and user_id has a default value.
    """
    # Automatically format order_id to match expected pattern if needed
    if not order_id.startswith("ORD-"):
        order_id = f"ORD-{order_id.zfill(6)}"
    
    return OrderStatusResponse(
        order_id=order_id,
        status=random.choice(list(OrderStatus)),
        last_updated=get_current_time()
    )

# Performance Testing Endpoints
@app.get("/delay/{seconds}", 
    tags=["performance"], 
    response_model=DelayResponse
)
async def delayed_response(seconds: float = Path(1, ge=0, le=30, description="Seconds to delay the response")):
    """
    Endpoint that introduces artificial delay to test timeout scenarios.
    """
    # Limit actual delay time to prevent server overload during stress testing
    actual_seconds = min(seconds, 5.0)
    time.sleep(actual_seconds)
    return DelayResponse(
        message=f"Response delayed by {actual_seconds} seconds",
        seconds_delayed=actual_seconds
    )

@app.get("/load/{intensity}", 
    tags=["performance"], 
    response_model=LoadTestResponse
)
async def cpu_load(params: LoadTestParams = Depends()):
    """
    Endpoint that generates CPU load for testing.
    """
    # Limit actual intensity and duration to prevent server overload during stress testing
    intensity = min(params.intensity, 5)
    duration = min(params.duration, 2.0)
    
    start_time = time.time()
    cpu_usage_start = psutil.cpu_percent()
    
    # Simulate CPU load
    while time.time() - start_time < duration:
        _ = [i * i for i in range(1000 * intensity)]
    
    cpu_usage_end = psutil.cpu_percent()
    
    return LoadTestResponse(
        intensity=intensity,
        duration=duration,
        completed=True,
        metrics={
            "cpu_usage_percent": (cpu_usage_start + cpu_usage_end) / 2,
            "memory_percent": psutil.virtual_memory().percent
        }
    )

# For stress testing - simple echo endpoint
@app.post("/echo", tags=["testing"])
async def echo_json(data: Optional[BaseModel] = None):
    """
    Echo endpoint for testing - accepts any data and returns it.
    Perfect for stress testing with any payload.
    """
    response = {
        "received": data.dict() if data else {},
        "timestamp": str(get_current_time()),
        "server_info": {
            "cpu": psutil.cpu_percent(),
            "memory": psutil.virtual_memory().percent
        }
    }
    return response

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
