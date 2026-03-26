import { env } from "../env.js";

// --- Client Credentials token (for search, no user auth needed) ---

let clientToken: string | null = null;
let clientTokenExpiresAt = 0;

async function getClientToken(): Promise<string> {
  if (clientToken && Date.now() < clientTokenExpiresAt) {
    return clientToken;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Client credentials error:", res.status, text);
    throw new Error(`Spotify client credentials failed: ${res.status}`);
  }

  const data = await res.json();
  clientToken = data.access_token;
  clientTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000; // refresh 1 min early
  return clientToken!;
}

// --- OAuth Authorization Code flow ---

export function getAuthorizeUrl(state: string): string {
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: scopes,
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return res.json();
}

export async function getUserProfile(
  token: string
): Promise<{ id: string; display_name: string; product: string }> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Get profile failed: ${res.status}`);
  }

  return res.json();
}

// --- Search ---

export interface SpotifyTrackResult {
  spotifyUri: string;
  title: string;
  artist: string;
  albumArt: string;
  durationMs: number;
}

export async function searchTracks(
  query: string
): Promise<SpotifyTrackResult[]> {
  const token = await getClientToken();

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "10",
  });

  const res = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Search error:", res.status, text);
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();

  return (data.tracks?.items || []).map(
    (track: {
      uri: string;
      name: string;
      artists: { name: string }[];
      album: { images: { url: string }[] };
      duration_ms: number;
    }) => ({
      spotifyUri: track.uri,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      albumArt: track.album.images[0]?.url || "",
      durationMs: track.duration_ms,
    })
  );
}
