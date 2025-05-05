# stress-api
StressAPI is a high-performance load testing tool built specifically for FastAPI. Simulate real-world traffic, stress-test endpoints, and uncover performance bottlenecks with ease.

Built for CS 1060 at Harvard University

## Google Drive Folder
https://drive.google.com/drive/folders/1Cvppbcl7qQH8WqOO8DFzMcTWwCTNPSnn?usp=sharing

## Authentication and Database Configuration

The application uses Supabase for both authentication and database storage:

1. **Authentication**: All authentication is handled via Supabase Auth
2. **Database**: User data and test sessions are stored in Supabase's PostgreSQL database

### Environment Variables

The following environment variables need to be set for the application to work:

```
# Supabase Authentication (required)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Database (required)
SUPABASE_DB_URL=postgresql://user:password@host:port/database
```

To set up the environment, copy `backend/sample.env` to `.env` in the project root:

```bash
cp backend/sample.env .env
```

Then edit the file with your Supabase credentials.