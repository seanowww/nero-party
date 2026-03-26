// Use the same hostname the browser is on (works for both localhost and LAN IP)
const API_URL = `${window.location.protocol}//${window.location.hostname}:3000`;

export interface SpotifyTrackResult {
  spotifyUri: string;
  title: string;
  artist: string;
  albumArt: string;
  durationMs: number;
}

export interface PartyData {
  id: string;
  name: string;
  code: string;
  hostId: string;
  maxSongs: number;
  timeLimitMin: number | null;
  status: string;
  currentTrackId: string | null;
  participants: {
    id: string;
    displayName: string;
    color: string;
    isHost: boolean;
    isPremium: boolean;
  }[];
  tracks: QueueTrack[];
}

export interface QueueTrack {
  id: string;
  spotifyUri: string;
  title: string;
  artist: string;
  albumArt: string;
  durationMs: number;
  addedBy: string;
  position: number;
  played: boolean;
  score: number;
  votes: { participantId: string; value: number }[];
}

export async function createParty(data: {
  name: string;
  hostName: string;
  maxSongs?: number;
  maxVotesPerUser?: number;
  timeLimitMin?: number;
}): Promise<{ id: string; code: string; participantId: string }> {
  const res = await fetch(`${API_URL}/api/parties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create party");
  return res.json();
}

export async function joinParty(
  code: string,
  displayName: string
): Promise<{
  partyId: string;
  participantId: string;
  participant: {
    id: string;
    displayName: string;
    color: string;
    isHost: boolean;
    isPremium: boolean;
  };
}> {
  const res = await fetch(`${API_URL}/api/parties/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to join party");
  }
  return res.json();
}

export async function getParty(id: string): Promise<PartyData> {
  const res = await fetch(`${API_URL}/api/parties/${id}`);
  if (!res.ok) throw new Error("Party not found");
  return res.json();
}

export async function searchSpotify(
  query: string
): Promise<SpotifyTrackResult[]> {
  const res = await fetch(
    `${API_URL}/api/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function getSpotifyLoginUrl(
  participantId: string,
  partyId: string
): string {
  return `${API_URL}/auth/spotify/login?participantId=${participantId}&partyId=${partyId}`;
}

export async function getSpotifyToken(
  participantId: string
): Promise<{ accessToken: string; expiresIn: number; isPremium: boolean } | null> {
  try {
    const res = await fetch(
      `${API_URL}/auth/spotify/token?participantId=${participantId}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
