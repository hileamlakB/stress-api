import os
import logging
from typing import Dict, Any, List, Optional
import httpx
import json
from datetime import datetime, timedelta

from backend.config.settings import SUPABASE_URL, SUPABASE_SERVICE_KEY, HAS_VALID_SUPABASE_CONFIG

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SupabaseService:
    """Service for interacting with Supabase APIs using the service role key"""
    
    def __init__(self):
        if not HAS_VALID_SUPABASE_CONFIG:
            logger.warning("Supabase configuration is invalid or missing. Some features may not work.")
        
        self.supabase_url = SUPABASE_URL
        self.service_key = SUPABASE_SERVICE_KEY
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json"
        }
    
    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a user by ID from Supabase Auth"""
        if not HAS_VALID_SUPABASE_CONFIG:
            logger.error("Cannot get user: Supabase configuration is invalid")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/auth/v1/admin/users/{user_id}",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to get user {user_id}: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting user from Supabase: {str(e)}")
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get a user by email from Supabase Auth"""
        if not HAS_VALID_SUPABASE_CONFIG:
            logger.error("Cannot get user by email: Supabase configuration is invalid")
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/auth/v1/admin/users",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    users = response.json()
                    for user in users:
                        if user.get("email") == email:
                            return user
                    logger.warning(f"User with email {email} not found in Supabase")
                    return None
                else:
                    logger.error(f"Failed to get users: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting user by email from Supabase: {str(e)}")
            return None
    
    async def list_users(self, page: int = 1, per_page: int = 100) -> List[Dict[str, Any]]:
        """List users from Supabase Auth with pagination"""
        if not HAS_VALID_SUPABASE_CONFIG:
            logger.error("Cannot list users: Supabase configuration is invalid")
            return []
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/auth/v1/admin/users",
                    headers=self.headers,
                    params={
                        "page": page,
                        "per_page": per_page
                    }
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to list users: {response.status_code} - {response.text}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error listing users from Supabase: {str(e)}")
            return []

# Create a singleton instance
supabase_service = SupabaseService() 