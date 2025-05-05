import os
import requests
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models import User
from backend.database.crud import get_user_by_email, create_user

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SupabaseUserSync:
    """Service to synchronize users between Supabase and the local database"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Supabase credentials not found in environment variables")
    
    def verify_and_sync_user(self, db: Session, email: str, token: str = None) -> User:
        """
        Verify if a user exists in Supabase and sync to local database if needed
        
        Args:
            db: Database session
            email: User email
            token: Optional JWT token for user verification
            
        Returns:
            User object from local database
        """
        # First check if user exists in local database
        db_user = get_user_by_email(db, email)
        
        if db_user:
            logger.info(f"User already exists in local DB: {email}")
            return db_user
        
        # User doesn't exist in local DB, try to verify with Supabase
        if token:
            # Verify token with Supabase
            is_valid_user = self._verify_token(token)
            if is_valid_user:
                # Create user in local database
                return self._create_user_in_local_db(db, email)
        
        # If token verification failed or no token provided,
        # check if user exists in Supabase using service key
        user_exists = self._check_user_exists_in_supabase(email)
        if user_exists:
            # Create user in local database
            return self._create_user_in_local_db(db, email)
        
        # User doesn't exist in Supabase either
        logger.warning(f"User not found in Supabase: {email}")
        return None
    
    def _verify_token(self, token: str) -> bool:
        """Verify JWT token with Supabase"""
        if not (self.supabase_url and self.supabase_key):
            return False
        
        try:
            # Call Supabase auth API to verify token
            headers = {
                "Authorization": f"Bearer {self.supabase_key}",
                "apikey": self.supabase_key
            }
            response = requests.get(
                f"{self.supabase_url}/auth/v1/user",
                headers=headers
            )
            
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error verifying token: {str(e)}")
            return False
    
    def _check_user_exists_in_supabase(self, email: str) -> bool:
        """Check if user exists in Supabase using service key"""
        if not (self.supabase_url and self.supabase_key):
            return False
        
        try:
            # Call Supabase API to check if user exists
            headers = {
                "Authorization": f"Bearer {self.supabase_key}",
                "apikey": self.supabase_key
            }
            
            # Use the service key to search for the user by email
            response = requests.get(
                f"{self.supabase_url}/auth/v1/admin/users",
                params={"email": email},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                return len(data) > 0 and data[0].get("email") == email
            
            return False
        except Exception as e:
            logger.error(f"Error checking user in Supabase: {str(e)}")
            return False
    
    def _create_user_in_local_db(self, db: Session, email: str) -> User:
        """Create user in local database"""
        logger.info(f"Creating user in local database: {email}")
        try:
            return create_user(db, email)
        except Exception as e:
            logger.error(f"Error creating user in local database: {str(e)}")
            return None

# Singleton instance
user_sync_service = SupabaseUserSync() 