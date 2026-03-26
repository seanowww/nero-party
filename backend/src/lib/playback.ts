import { Server } from "socket.io";
import { prisma } from "./prisma.js";
import { computeScore, POINTS } from "./scoring.js";

interface PartyPlayback {
  currentTrackId: string | null;
  spotifyUri: string | null;
  isPlaying: boolean;
  startedAt: number;
  positionMs: number;
  durationMs: number;
  title: string;
  artist: string;
  albumArt: string;
  trackEndTimer: ReturnType<typeof setTimeout> | null;
}

const partyStates = new Map<string, PartyPlayback>();

// --- Party time-limit timers ---
const partyEndTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Schedule automatic party end based on timeLimitMin. Safe to call multiple times — deduplicates. */
export function schedulePartyEnd(
  partyId: string,
  timeLimitMin: number | null,
  createdAt: Date,
  io: Server
): void {
  if (!timeLimitMin || partyEndTimers.has(partyId)) return;

  const endTime = new Date(createdAt).getTime() + timeLimitMin * 60 * 1000;
  const remaining = endTime - Date.now();

  if (remaining <= 0) {
    // Already past the limit — end immediately
    endParty(partyId, io);
    return;
  }

  const timer = setTimeout(async () => {
    partyEndTimers.delete(partyId);
    await endParty(partyId, io);
  }, remaining);

  partyEndTimers.set(partyId, timer);
}

function clearPartyEndTimer(partyId: string): void {
  const timer = partyEndTimers.get(partyId);
  if (timer) {
    clearTimeout(timer);
    partyEndTimers.delete(partyId);
  }
}

// --- Promise-chain lock per party (prevents race conditions) ---

const partyLocks = new Map<string, Promise<void>>();

export async function withPartyLock(
  partyId: string,
  fn: () => Promise<void>
): Promise<void> {
  const prev = partyLocks.get(partyId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  partyLocks.set(partyId, next);
  await next;
}

// --- Position helpers ---

function getCurrentPositionMs(state: PartyPlayback): number {
  if (!state.isPlaying) return state.positionMs;
  return state.positionMs + (Date.now() - state.startedAt);
}

function scheduleTrackEnd(
  partyId: string,
  state: PartyPlayback,
  io: Server
): void {
  if (state.trackEndTimer) clearTimeout(state.trackEndTimer);

  const remaining = state.durationMs - getCurrentPositionMs(state);
  if (remaining <= 0) {
    skipTrack(partyId, io);
    return;
  }

  state.trackEndTimer = setTimeout(async () => {
    const current = partyStates.get(partyId);
    if (
      current?.currentTrackId === state.currentTrackId &&
      current.isPlaying
    ) {
      await skipTrack(partyId, io);
    }
  }, remaining + 1000);
}

function clearTimer(state: PartyPlayback): void {
  if (state.trackEndTimer) {
    clearTimeout(state.trackEndTimer);
    state.trackEndTimer = null;
  }
}

// --- Persistence helpers ---

async function persistPlaybackState(partyId: string): Promise<void> {
  const state = partyStates.get(partyId);
  if (!state) return;

  await prisma.party.update({
    where: { id: partyId },
    data: {
      currentTrackId: state.currentTrackId,
      isPlaying: state.isPlaying,
      positionMs: state.positionMs,
      startedAt: BigInt(state.startedAt),
    },
  });
}

/** Reconstruct in-memory playback state from DB (e.g., after server restart) */
export async function restorePlaybackState(
  partyId: string,
  io: Server
): Promise<PartyPlayback | null> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
  });

  if (!party || party.status === "ended" || !party.currentTrackId) {
    return null;
  }

  const track = await prisma.queueTrack.findUnique({
    where: { id: party.currentTrackId },
  });

  if (!track) return null;

  const state: PartyPlayback = {
    currentTrackId: party.currentTrackId,
    spotifyUri: track.spotifyUri,
    isPlaying: party.isPlaying,
    startedAt: Number(party.startedAt),
    positionMs: party.positionMs,
    durationMs: track.durationMs,
    title: track.title,
    artist: track.artist,
    albumArt: track.albumArt,
    trackEndTimer: null,
  };

  partyStates.set(partyId, state);

  if (state.isPlaying) {
    scheduleTrackEnd(partyId, state, io);
  }

  return state;
}

// --- Drift correction ---

const DRIFT_THRESHOLD_MS = 2000;

/** Compare a client's reported position against the authoritative state.
 *  Returns the corrected position if drift exceeds threshold, or null if in sync. */
export function checkDrift(
  partyId: string,
  clientPositionMs: number
): { correctPositionMs: number; spotifyUri: string } | null {
  const state = partyStates.get(partyId);
  if (!state || !state.isPlaying || !state.spotifyUri) return null;

  const serverPosition = getCurrentPositionMs(state);
  const drift = Math.abs(serverPosition - clientPositionMs);

  if (drift > DRIFT_THRESHOLD_MS) {
    return { correctPositionMs: serverPosition, spotifyUri: state.spotifyUri };
  }
  return null;
}

// --- Public API ---

export function getPlaybackForClient(partyId: string): {
  trackId: string | null;
  currentTrackId: string | null;
  spotifyUri: string | null;
  isPlaying: boolean;
  startedAt: number;
  positionMs: number;
  durationMs: number;
  title: string;
  artist: string;
  albumArt: string;
} | null {
  const state = partyStates.get(partyId);
  if (!state || !state.currentTrackId) return null;

  return {
    trackId: state.currentTrackId,
    currentTrackId: state.currentTrackId,
    spotifyUri: state.spotifyUri,
    isPlaying: state.isPlaying,
    startedAt: Date.now(),
    positionMs: getCurrentPositionMs(state),
    durationMs: state.durationMs,
    title: state.title,
    artist: state.artist,
    albumArt: state.albumArt,
  };
}

export async function startNextTrack(
  partyId: string,
  io: Server
): Promise<void> {
  const prev = partyStates.get(partyId);
  if (prev) clearTimer(prev);

  const nextTrack = await prisma.queueTrack.findFirst({
    where: { partyId, played: false },
    orderBy: { position: "asc" },
  });

  if (!nextTrack) {
    partyStates.delete(partyId);
    await prisma.party.update({
      where: { id: partyId },
      data: {
        currentTrackId: null,
        isPlaying: false,
        positionMs: 0,
        startedAt: BigInt(0),
      },
    });
    io.to(partyId).emit("playback:queue-empty", {});
    return;
  }

  const now = Date.now();
  const state: PartyPlayback = {
    currentTrackId: nextTrack.id,
    spotifyUri: nextTrack.spotifyUri,
    isPlaying: true,
    startedAt: now,
    positionMs: 0,
    durationMs: nextTrack.durationMs,
    title: nextTrack.title,
    artist: nextTrack.artist,
    albumArt: nextTrack.albumArt,
    trackEndTimer: null,
  };
  partyStates.set(partyId, state);

  scheduleTrackEnd(partyId, state, io);
  await persistPlaybackState(partyId);

  await prisma.party.update({
    where: { id: partyId },
    data: { currentTrackId: nextTrack.id },
  });

  io.to(partyId).emit("playback:play", {
    trackId: nextTrack.id,
    spotifyUri: nextTrack.spotifyUri,
    title: nextTrack.title,
    artist: nextTrack.artist,
    albumArt: nextTrack.albumArt,
    durationMs: nextTrack.durationMs,
    startedAt: state.startedAt,
    positionMs: 0,
  });
}

export async function pausePlayback(
  partyId: string,
  io: Server
): Promise<void> {
  const state = partyStates.get(partyId);
  if (!state || !state.isPlaying) return;

  state.positionMs = getCurrentPositionMs(state);
  state.isPlaying = false;
  state.startedAt = Date.now();
  clearTimer(state);

  await persistPlaybackState(partyId);

  io.to(partyId).emit("playback:pause", {
    positionMs: state.positionMs,
  });
}

export async function resumePlayback(
  partyId: string,
  io: Server
): Promise<void> {
  const state = partyStates.get(partyId);
  if (!state || state.isPlaying || !state.spotifyUri) return;

  state.startedAt = Date.now();
  state.isPlaying = true;

  scheduleTrackEnd(partyId, state, io);
  await persistPlaybackState(partyId);

  io.to(partyId).emit("playback:resume", {
    spotifyUri: state.spotifyUri,
    trackId: state.currentTrackId,
    positionMs: state.positionMs,
    startedAt: state.startedAt,
  });
}

export async function seekPlayback(
  partyId: string,
  positionMs: number,
  io: Server,
  excludeSocketId?: string
): Promise<void> {
  const state = partyStates.get(partyId);
  if (!state || !state.spotifyUri) return;

  state.positionMs = positionMs;
  state.startedAt = Date.now();

  if (state.isPlaying) {
    scheduleTrackEnd(partyId, state, io);
  }

  await persistPlaybackState(partyId);

  const target = excludeSocketId
    ? io.to(partyId).except(excludeSocketId)
    : io.to(partyId);
  target.emit("playback:seek", {
    positionMs,
    spotifyUri: state.spotifyUri,
    trackId: state.currentTrackId,
  });
}

export async function previousTrack(
  partyId: string,
  io: Server
): Promise<void> {
  const state = partyStates.get(partyId);
  if (state) clearTimer(state);

  const prevTrack = await prisma.queueTrack.findFirst({
    where: { partyId, played: true },
    orderBy: { position: "desc" },
  });

  if (!prevTrack) return;

  if (state?.currentTrackId) {
    await prisma.queueTrack.update({
      where: { id: state.currentTrackId },
      data: { played: false },
    });
  }

  await prisma.queueTrack.update({
    where: { id: prevTrack.id },
    data: { played: false },
  });

  await startNextTrack(partyId, io);
}

export async function skipTrack(
  partyId: string,
  io: Server
): Promise<void> {
  const state = partyStates.get(partyId);
  if (state) clearTimer(state);

  if (state?.currentTrackId) {
    await prisma.queueTrack.update({
      where: { id: state.currentTrackId },
      data: { played: true },
    });
  }

  await startNextTrack(partyId, io);
}

export async function endParty(
  partyId: string,
  io: Server
): Promise<void> {
  const state = partyStates.get(partyId);
  if (state) clearTimer(state);
  partyStates.delete(partyId);
  clearPartyEndTimer(partyId);

  await prisma.party.update({
    where: { id: partyId },
    data: {
      status: "ended",
      currentTrackId: null,
      isPlaying: false,
      positionMs: 0,
      startedAt: BigInt(0),
    },
  });

  // Compute weighted scores, aggregating duplicates by spotifyUri
  const tracks = await prisma.queueTrack.findMany({
    where: { partyId },
    include: {
      votes: { select: { participantId: true, value: true } },
      reactions: { select: { id: true, type: true } },
    },
  });

  // Active participants = anyone who voted or reacted
  const [voters, reactors] = await Promise.all([
    prisma.vote.findMany({
      where: { track: { partyId }, value: 1 },
      select: { participantId: true },
      distinct: ["participantId"],
    }),
    prisma.trackReaction.findMany({
      where: { track: { partyId } },
      select: { participantId: true },
      distinct: ["participantId"],
    }),
  ]);
  const activeIds = new Set([
    ...voters.map((v) => v.participantId),
    ...reactors.map((r) => r.participantId),
  ]);
  const activeParticipantCount =
    activeIds.size ||
    (await prisma.participant.count({ where: { partyId } }));

  // Group tracks by spotifyUri so duplicate adds share one score
  const grouped = new Map<string, typeof tracks>();
  for (const t of tracks) {
    const list = grouped.get(t.spotifyUri) || [];
    list.push(t);
    grouped.set(t.spotifyUri, list);
  }

  const scored = Array.from(grouped.values()).map((group) => {
    const first = group[0];

    // Merge votes and reactions across all instances of this song
    const allVotes = group.flatMap((t) => t.votes);
    const allReactions = group.flatMap((t) => t.reactions);

    const voteCount = allVotes.filter((v) => v.value === 1).length;
    const commentCount = allReactions.filter((r) => r.type === "text").length;
    const emojiCount = allReactions.filter((r) => r.type === "emoji").length;

    const totalScore = computeScore({
      votes: allVotes,
      commentCount,
      emojiCount,
      addedByParticipantId: first.addedByParticipantId,
      activeParticipantCount,
    });

    return {
      id: first.id,
      title: first.title,
      artist: first.artist,
      albumArt: first.albumArt,
      addedBy: first.addedBy,
      position: first.position,
      totalScore,
      voteCount,
      reactionCount: allReactions.length,
    };
  });

  // Sort by score, then tiebreak: voteCount > reactionCount > earlier position
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    if (b.reactionCount !== a.reactionCount)
      return b.reactionCount - a.reactionCount;
    return a.position - b.position;
  });

  // Minimum vote threshold: songs with < 2 votes can't take the Winner title
  // Rankings stay sorted by score — winner is the first eligible song
  const winnerIdx = scored.findIndex(
    (t) => t.voteCount >= POINTS.MIN_VOTES_TO_WIN
  );

  const rankings = scored.map((t, i) => ({
    rank: i + 1,
    ...t,
  }));

  io.to(partyId).emit("party:ended", {
    winner: winnerIdx >= 0 ? rankings[winnerIdx] : null,
    rankings,
  });
}
