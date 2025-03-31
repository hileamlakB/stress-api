from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

# Base Response Model
class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None

# User Models
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, example="john_doe")
    email: EmailStr = Field(..., example="john@example.com")
    role: UserRole = Field(..., example=UserRole.USER)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, example="strongpassword123")

class User(UserBase):
    id: int = Field(..., ge=1, example=1)
    active: bool = True
    created_at: datetime

class UserResponse(BaseResponse):
    data: Optional[User] = None

class UsersListResponse(BaseResponse):
    data: List[User]
    total: int
    page: int
    page_size: int

# Product Models
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, example="Wireless Headphones")
    price: float = Field(..., gt=0, example=99.99)
    description: Optional[str] = Field(None, max_length=1000, example="High-quality wireless headphones")
    tags: List[str] = Field(default_factory=list, example=["electronics", "audio"])

class ProductCreate(ProductBase):
    sku: str = Field(..., pattern="^[A-Z0-9]{8}$", example="PROD1234")

class Product(ProductBase):
    id: int = Field(..., ge=1, example=1)
    in_stock: bool = True
    created_at: datetime
    image_url: Optional[HttpUrl] = None

class ProductResponse(BaseResponse):
    data: Optional[Product] = None

class ProductSearchParams(BaseModel):
    query: Optional[str] = Field(None, min_length=2, example="headphones")
    min_price: Optional[float] = Field(None, ge=0, example=10.0)
    max_price: Optional[float] = Field(None, ge=0, example=1000.0)
    tags: Optional[List[str]] = None
    limit: int = Field(10, ge=1, le=100, example=10)
    page: int = Field(1, ge=1, example=1)

class ProductSearchResponse(BaseResponse):
    data: List[Product]
    total: int
    page: int
    page_size: int

# Order Models
class OrderItem(BaseModel):
    product_id: int = Field(..., ge=1, example=1)
    quantity: int = Field(..., gt=0, le=100, example=1)
    unit_price: float = Field(..., gt=0, example=99.99)

class OrderCreate(BaseModel):
    user_id: int = Field(..., ge=1, example=1)
    items: List[OrderItem]
    shipping_address: str = Field(..., min_length=10, max_length=200, example="123 Main St, City, Country")

class Order(BaseModel):
    id: str = Field(..., pattern="^ORD-[0-9]{6}$", example="ORD-123456")
    user_id: int
    items: List[OrderItem]
    total_amount: float = Field(..., ge=0, example=99.99)
    status: OrderStatus = Field(default=OrderStatus.PENDING)
    created_at: datetime
    updated_at: datetime
    shipping_address: str

class OrderResponse(BaseResponse):
    data: Optional[Order] = None

class OrderStatusResponse(BaseResponse):
    order_id: str = Field(..., pattern="^ORD-[0-9]{6}$")
    status: OrderStatus
    last_updated: datetime

# Performance Test Models
class DelayResponse(BaseResponse):
    seconds_delayed: float = Field(..., ge=0, le=30, example=5.0)

class LoadTestParams(BaseModel):
    intensity: int = Field(..., ge=1, le=10, example=5)
    duration: float = Field(1.0, ge=0, le=5, example=1.0)

class LoadTestResponse(BaseResponse):
    intensity: int
    duration: float
    completed: bool
    metrics: Dict[str, float]  # CPU usage, memory usage, etc.

# Error Models
class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    error_code: str
    details: Optional[Dict] = None
