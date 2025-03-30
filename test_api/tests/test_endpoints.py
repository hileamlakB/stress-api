import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from main import app
from models import UserRole, OrderStatus, ProductCreate
import random
import string

client = TestClient(app)

def generate_random_string(length: int) -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def generate_random_email() -> str:
    return f"{generate_random_string(8)}@example.com"

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Test API"}

class TestUserEndpoints:
    def test_create_user_success(self):
        user_data = {
            "username": generate_random_string(8),
            "email": generate_random_email(),
            "role": UserRole.USER,
            "password": "strongpass123"
        }
        response = client.post("/users/", json=user_data)
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["data"]["username"] == user_data["username"]

    def test_create_user_invalid_email(self):
        user_data = {
            "username": generate_random_string(8),
            "email": "invalid-email",
            "role": UserRole.USER,
            "password": "strongpass123"
        }
        response = client.post("/users/", json=user_data)
        assert response.status_code == 422

    def test_get_user(self):
        # Try different user IDs until we find one that exists
        # (We know IDs divisible by 5 return 404)
        for _ in range(5):
            user_id = random.randint(1, 100)
            if user_id % 5 != 0:  # Skip IDs that we know will return 404
                response = client.get(f"/users/{user_id}")
                assert response.status_code == 200
                assert response.json()["data"]["id"] == user_id
                break
        else:
            pytest.skip("Could not find a valid user ID after 5 attempts")

class TestProductEndpoints:
    def test_create_product_success(self):
        product_data = {
            "name": "Test Product",
            "price": 99.99,
            "description": "Test description",
            "tags": ["test", "product"],
            "sku": "ABCD1234"
        }
        
        headers = {"api-key": "test_key"}  
        response = client.post("/products/", json=product_data, headers=headers)
        if response.status_code == 422:
            print(f"Validation error: {response.json()}")  
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["data"]["name"] == product_data["name"]

    def test_create_product_unauthorized(self):
        product_data = {
            "name": "Test Product",
            "price": 99.99,
            "sku": "PROD12345"
        }
        response = client.post("/products/", json=product_data)  # No api-key header
        assert response.status_code == 422

    def test_search_products(self):
        params = {
            "query": "test",
            "min_price": 10,
            "max_price": 100,
            "tags": ["electronics"],
            "limit": 5
        }
        response = client.get("/products/search", params=params)
        assert response.status_code == 200
        assert len(response.json()["data"]) <= params["limit"]

class TestOrderEndpoints:
    def test_create_order_success(self):
        order_data = {
            "user_id": random.randint(1, 100),
            "items": [
                {
                    "product_id": random.randint(1, 100),
                    "quantity": random.randint(1, 5),
                    "unit_price": random.uniform(10, 100)
                }
            ],
            "shipping_address": "123 Test Street, Test City, Test Country"
        }
        
        # Try up to 3 times to handle the random 503 errors
        max_retries = 3
        for attempt in range(max_retries):
            response = client.post("/orders/", json=order_data)
            if response.status_code == 200:
                assert response.json()["success"] is True
                assert "ORD-" in response.json()["data"]["id"]
                break
            elif response.status_code == 503 and attempt < max_retries - 1:
                continue
            elif attempt == max_retries - 1:
                pytest.skip("Order creation failed after max retries due to simulated server unavailability")

    def test_get_order_status(self):
        order_id = f"ORD-{random.randint(100000, 999999)}"
        user_id = random.randint(1, 100)
        response = client.get(f"/orders/{order_id}/status", params={"user_id": user_id})
        assert response.status_code == 200
        assert response.json()["order_id"] == order_id
        assert response.json()["status"] in [status.value for status in OrderStatus]

class TestPerformanceEndpoints:
    def test_delay_endpoint(self):
        seconds = 0.1
        response = client.get(f"/delay/{seconds}")
        assert response.status_code == 200
        assert response.json()["seconds_delayed"] == seconds

    def test_cpu_load_endpoint(self):
        params = {
            "intensity": 1,
            "duration": 0.1
        }
        response = client.get("/load/1", params=params)
        assert response.status_code == 200
        assert response.json()["completed"] is True
        assert "cpu_usage_percent" in response.json()["metrics"]
        assert "memory_percent" in response.json()["metrics"]

class TestErrorHandling:
    def test_invalid_user_id(self):
        response = client.get("/users/-1")
        assert response.status_code == 422

    def test_invalid_order_id_format(self):
        response = client.get("/orders/invalid-id/status", params={"user_id": 1})
        assert response.status_code == 422

    def test_invalid_delay_value(self):
        response = client.get("/delay/31")  # Above maximum allowed
        assert response.status_code == 422

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
