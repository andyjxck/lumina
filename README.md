# Animal Crossing Villager Trading Platform

A web/mobile application for efficient Animal Crossing villager trading with queue management and scheduling system.

## Features

### Core Trading Flow
1. **Villager Catalog** - Browse and search for villagers to trade
2. **Basket System** - Add multiple villagers to request basket
3. **Queue Management** - First-come-first-serve with plot-ready verification
4. **Scheduling** - Timeslot booking and Dodo code distribution
5. **Trade Verification** - Completion confirmation system

### Key Systems
- User authentication with in-game username & island name
- Real-time notifications for trade availability
- Automatic queue management with plot-ready priority
- Supplier dashboard for managing trades
- Mobile-responsive design

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.io for notifications
- **Authentication**: JWT tokens
- **State Management**: React Context/Redux

## Database Schema

### Users
- id, email, username, islandName, isSupplier, createdAt

### Villagers  
- id, name, personality, species, imageUrl, popularity

### Trades
- id, requesterId, supplierId, villagerId, status, queuePosition, plotReady, scheduledTime, dodoCode, completedAt

### Queue
- tradeId, position, plotReady, joinedAt

## Database Setup

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL from `database.sql` in the Supabase SQL Editor
3. Get your database URL from Supabase settings
4. Update `server/.env` with your Supabase database URL

### Environment Variables
```env
DATABASE_URL="your-supabase-database-url"
CLIENT_URL="http://localhost:3000"
PORT=5000
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
```

## Getting Started

1. Clone repository
2. Install dependencies: `npm run install:all`
3. Set up Supabase database (see above)
4. Start development: `npm run dev`

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/profile

### Villagers
- GET /api/villagers (with search/filter)
- GET /api/villagers/:id

### Trades
- POST /api/trades/request
- GET /api/trades/queue
- POST /api/trades/accept
- POST /api/trades/complete
- PUT /api/trades/plot-ready

### Notifications
- WebSocket connection for real-time updates
