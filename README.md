# Nero Party

A real-time listening party app where friends join a room, queue up songs, vote on their favorites, and crown a winning track at the end.

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A **Spotify Developer** account (free) for song search
- A **Spotify Premium** account for audio playback (search works without Premium, but playback requires it)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Spotify API credentials

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Set the **Redirect URI** to `http://127.0.0.1:3000/auth/spotify/callback`
4. Copy your **Client ID** and **Client Secret**
5. Under **Settings > User Management**, add the Spotify email of anyone who will test the app (Spotify apps in dev mode only allow manually approved users)

Then configure your environment:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Spotify credentials:

```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 3. Set up the database

```bash
cd backend && npx prisma migrate dev && cd ..
```

### 4. Start the dev servers

```bash
npm run dev
```

This starts:
- **Backend** on `http://localhost:3000`
- **Frontend** on `http://localhost:5173`

Open `http://localhost:5173` to use the app.

## How It Works

1. **Create a party** with a name and optional limits (max songs, max votes per user, time limit)
2. **Share the 6-character code** or invite link with friends
3. **Connect to Spotify** in the party room to enable playback
4. **Search and add songs** to the shared queue
5. **Vote and react** on songs as they play (fire, heart, sparkle, etc.)
6. **End the party** to reveal the winning song, ranked by a weighted score of votes, reactions, and listen time

## Project Structure

```
nero-party/
├── backend/          # Express + Socket.IO server
│   ├── prisma/       # Database schema & migrations
│   └── src/
│       ├── lib/      # Playback sync, scoring, Spotify client
│       └── routes/   # REST API routes
└── frontend/         # React + Vite client
    └── src/
        ├── components/  # UI components
        ├── hooks/       # Custom React hooks
        ├── pages/       # Route pages
        └── lib/         # API client, socket config
```

## Tech Stack

- **Backend:** Express.js, Prisma, Socket.IO
- **Frontend:** React, Vite, TailwindCSS, Framer Motion
- **Database:** SQLite (local, no setup required)
- **Music API:** Spotify Web API (search) + Spotify Web Playback SDK (audio)

## Scoring Algorithm

Songs are ranked by a weighted score:

| Factor      | Points                         | Notes                                    |
|-------------|--------------------------------|------------------------------------------|
| Votes       | 300 per vote                   | 100 if self-voted (discourages gaming)   |
| Vote boost  | multiplied by participation rate | Rewards broadly loved songs              |
| Comments    | 200 per comment                | 65 if on your own song                   |
| Emoji       | 100 per reaction               | 35 if on your own song                   |

All self-interactions (votes, comments, emoji) are discounted to ~1/3 value. A song needs at least 2 votes to be eligible for the win.
