# FastAPI Stress Tester

A powerful web application for stress testing FastAPI applications with real-time monitoring and comprehensive analytics. Built with React and Supabase for authentication.

![FastAPI Stress Tester](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000)

## Features

- 🔐 User authentication with Supabase
- 📊 Real-time performance monitoring
- 📈 Comprehensive test analytics
- 🎯 Multiple testing strategies
- 📱 Responsive Apple-inspired design

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Supabase account
- A FastAPI application to test against

## Environment Setup

1. Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your Supabase project:
1. Go to https://supabase.com
2. Create a new project or select existing one
3. Go to Project Settings > API
4. Copy the URL and anon/public key

## Required FastAPI Endpoints

Your FastAPI application needs to expose these endpoints for the stress tester to work:

1. OpenAPI Schema
   ```
   GET /openapi.json
   ```
   This is automatically provided by FastAPI and must be enabled.

2. Health Check (recommended)
   ```
   GET /health
   ```
   A simple endpoint to verify the API is running.

Your FastAPI application should:
- Have CORS enabled for your frontend domain
- Return proper HTTP status codes
- Handle rate limiting appropriately
- Return JSON responses

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create and configure your `.env` file
4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Register/Login to your account
2. Enter your FastAPI application's base URL
3. Click "Fetch Endpoints" to load available routes
4. Configure test parameters:
   - Number of concurrent users
   - Request rate
   - Test duration
   - Payload data (if required)
5. Start the stress test
6. Monitor results in real-time
7. View detailed analytics after test completion

## Authentication

The application uses Supabase for authentication. Users can:
- Register with email/password
- Login with existing credentials
- Access protected dashboard features
- Manage their test history

## Project Structure

```
├── src/
│   ├── components/    # Reusable UI components
│   ├── lib/          # Utilities and configurations
│   ├── pages/        # Main application pages
│   └── main.tsx      # Application entry point
├── .env              # Environment variables
├── package.json      # Project dependencies
└── README.md         # Project documentation
```

## Development

- Built with Vite + React
- Uses TypeScript for type safety
- Styled with Tailwind CSS
- Uses React Query for data fetching
- Implements React Router for navigation

## Security Considerations

- Environment variables are properly handled
- Authentication state is managed securely
- API requests are protected
- Rate limiting is implemented
- Error handling is in place

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT License - feel free to use this project for your own purposes.