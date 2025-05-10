from fastapi import FastAPI, HTTPException, Query, Path, Body, Header, Depends
from typing import Optional, List
import random
import time
from datetime import datetime
import psutil

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

def verify_api_key(api_key: str = Header(..., description="API key for authentication")):
    if api_key != "test_key":
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
async def create_user(user: UserCreate):
    """
    Create a new user in the system.
    """
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
    user_id: int = Path(..., ge=1),
    include_orders: bool = Query(False)
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
async def create_product(product: ProductCreate):
    """
    Create a new product in the catalog.
    """
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
    time.sleep(0.5 if params.tags else 0.2)
    
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
async def create_order(order: OrderCreate):
    """
    Create a new order in the system.
    """
    if random.random() < 0.2:  # 20% chance of failure
        raise HTTPException(
            status_code=503, 
            detail="Order processing system temporarily unavailable"
        )
    
    new_order = Order(
        id=f"ORD-{random.randint(100000, 999999)}",
        user_id=order.user_id,
        items=order.items,
        total_amount=sum(item.quantity * item.unit_price for item in order.items),
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
    order_id: str = Path(...),
    user_id: int = Query(1, ge=1, description="ID of the user who placed the order")
):
    """
    Check the status of an existing order.
    """
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
async def delayed_response(seconds: float = Path(..., ge=0, le=30)):
    """
    Endpoint that introduces artificial delay to test timeout scenarios.
    """
    time.sleep(seconds)
    return DelayResponse(
        message=f"Response delayed by {seconds} seconds",
        seconds_delayed=seconds
    )

@app.get("/load/{intensity}", 
    tags=["performance"], 
    response_model=LoadTestResponse
)
async def cpu_load(params: LoadTestParams = Depends()):
    """
    Endpoint that generates CPU load for testing.
    """
    start_time = time.time()
    cpu_usage_start = psutil.cpu_percent()
    
    # Simulate CPU load
    while time.time() - start_time < params.duration:
        _ = [i * i for i in range(1000 * params.intensity)]
    
    cpu_usage_end = psutil.cpu_percent()
    
    return LoadTestResponse(
        intensity=params.intensity,
        duration=params.duration,
        completed=True,
        metrics={
            "cpu_usage_percent": (cpu_usage_start + cpu_usage_end) / 2,
            "memory_percent": psutil.virtual_memory().percent
        }
    )

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
