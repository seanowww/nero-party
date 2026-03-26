import dotenv from "dotenv";
import path from "path";

// Load .env from project root (cwd is backend/ when run via npm script)
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
// Also try cwd itself (if run from root)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  PORT: process.env.PORT || 3000,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
  SPOTIFY_REDIRECT_URI:
    process.env.SPOTIFY_REDIRECT_URI ||
    "http://127.0.0.1:3000/auth/spotify/callback",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
};
