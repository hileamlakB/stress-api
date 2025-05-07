import os
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env files
load_dotenv()  # Load from root .env first
load_dotenv("backend/.env")  # Then override with backend-specific .env if it exists

# Supabase settings
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Check if Supabase configuration is valid
HAS_VALID_SUPABASE_CONFIG = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Database settings
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
SUPABASE_DB_SESSION_POOLER = os.getenv("SUPABASE_DB_SESSION_POOLER")

# Validate required environment variables
if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_KEY:
    logger.error("Missing required Supabase credentials in environment variables.")
    logger.error("Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY.")
    raise ValueError("Missing required Supabase credentials")

# Check for database URL - try session pooler first, then direct connection
if SUPABASE_DB_SESSION_POOLER:
    DATABASE_URL = SUPABASE_DB_SESSION_POOLER
    logger.info("Using Supabase PostgreSQL Session Pooler")
elif SUPABASE_DB_URL:
    DATABASE_URL = SUPABASE_DB_URL
    logger.info("Using Supabase PostgreSQL Direct Connection")
else:
    logger.error("No database connection string found in environment variables.")
    logger.error("Please set SUPABASE_DB_URL or SUPABASE_DB_SESSION_POOLER.")
    raise ValueError("Missing PostgreSQL database URL")

if not SUPABASE_JWT_SECRET:
    logger.warning("SUPABASE_JWT_SECRET not found in environment variables.")
    logger.warning("JWT token validation will be incomplete without this secret.")

# App settings
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# CORS settings
CORS_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",  # Next.js default
    "http://localhost:5173",  # Vite default
    "http://localhost:5174",  # Vite preview
    "http://127.0.0.1:5173",  # Vite default (IP)
    "http://127.0.0.1:5174",  # Vite preview (IP)
    "https://stress-api.vercel.app",  # Production Vercel deployment
    "https://stressapi.com"
]

# Database settings for SQLAlchemy
USING_POSTGRES = True
logger.info(f"Database URL: {DATABASE_URL}")

# Debug flag - only enable in development
DEBUG = os.getenv("DEBUG", "False").lower() in ["true", "1", "t"]

# User sync settings
USER_SYNC_INTERVAL_HOURS = int(os.getenv("USER_SYNC_INTERVAL_HOURS", "1")) 