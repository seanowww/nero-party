import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";
import {
  startNextTrack,
  pausePlayback,
  resumePlayback,
  skipTrack,
  previousTrack,
  seekPlayback,
  endParty,
  getPlaybackForClient,
  restorePlaybackState,
  withPartyLock,
  checkDrift,
  schedulePartyEnd,
  computePartyResults,
} from "./lib/playback.js";
import { computeScore } from "./lib/scoring.js";
import authRoutes from "./routes/auth.js";
import partyRoutes from "./routes/parties.js";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: (_origin, callback) => {
      // Allow all origins in development (LAN IPs, localhost, etc.)
      callback(null, true);
    },
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/auth", authRoutes);
app.use("/api/parties", partyRoutes);

// Separate search route (not nested under /api/parties/:id)
app.get("/api/search", async (req, res) => {
  const { searchTracks } = await import("./lib/spotify.js");
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "q parameter required" });
    return;
  }
  try {
    const results = await searchTracks(q);
    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// --- Scoring helpers ---
async function getReactionCounts(
  trackId: string,
  addedByParticipantId: string | null
): Promise<[commentCount: number, emojiCount: number, selfCommentCount: number, selfEmojiCount: number]> {
  const [commentCount, emojiCount, selfCommentCount, selfEmojiCount] = await Promise.all([
    prisma.trackReaction.count({ where: { trackId, type: "text" } }),
    prisma.trackReaction.count({ where: { trackId, type: "emoji" } }),
    addedByParticipantId
      ? prisma.trackReaction.count({ where: { trackId, type: "text", participantId: addedByParticipantId } })
      : Promise.resolve(0),
    addedByParticipantId
      ? prisma.trackReaction.count({ where: { trackId, type: "emoji", participantId: addedByParticipantId } })
      : Promise.resolve(0),
  ]);
  return [commentCount, emojiCount, selfCommentCount, selfEmojiCount];
}

async function getActiveParticipantCount(partyId: string): Promise<number> {
  // Active = anyone who cast a vote or sent a reaction in this party
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
  const uniqueIds = new Set([
    ...voters.map((v) => v.participantId),
    ...reactors.map((r) => r.participantId),
  ]);
  // Fall back to total participant count if nobody has engaged yet
  return uniqueIds.size || await prisma.participant.count({ where: { partyId } });
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // --- Join party room ---
  socket.on(
    "join:party",
    async (data: { partyId: string; participantId: string }) => {
      const { partyId, participantId } = data;
      socket.join(partyId);

      // Update socket ID on participant
      await prisma.participant
        .update({
          where: { id: participantId },
          data: { socketId: socket.id },
        })
        .catch(() => {});

      // Send full party state
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          participants: {
            select: {
              id: true,
              displayName: true,
              color: true,
              isHost: true,
              isPremium: true,
            },
          },
          tracks: {
            orderBy: { position: "asc" },
            include: {
              votes: { select: { participantId: true, value: true } },
            },
          },
        },
      });

      if (party) {
        let playback = getPlaybackForClient(partyId);
        // Restore from DB if in-memory state is missing (e.g., after server restart)
        if (!playback && party.currentTrackId) {
          await restorePlaybackState(partyId, io);
          playback = getPlaybackForClient(partyId);
        }
        // Strip BigInt fields from party before sending (JSON can't serialize BigInt)
        const { startedAt: _sa, isPlaying: _ip, positionMs: _pm, ...partyData } = party;
        socket.emit("party:state", { ...partyData, playback });

        // If the party has ended, send results so late-joiners see the results screen
        if (party.status === "ended") {
          const results = await computePartyResults(partyId);
          socket.emit("party:ended", results);
        }

        // Schedule time-limit auto-end (deduplicates if already scheduled)
        if (party.status === "active") {
          schedulePartyEnd(partyId, party.timeLimitMin, party.createdAt, io);
        }

        // Notify others
        socket.to(partyId).emit("participants:updated", {
          participants: party.participants,
        });
      }
    }
  );

  // --- Add track to queue ---
  socket.on(
    "queue:add",
    async (data: {
      partyId: string;
      participantId: string;
      spotifyUri: string;
      title: string;
      artist: string;
      albumArt: string;
      durationMs: number;
    }) => {
      const {
        partyId,
        participantId,
        spotifyUri,
        title,
        artist,
        albumArt,
        durationMs,
      } = data;

      try {
        // Get participant name
        const participant = await prisma.participant.findUnique({
          where: { id: participantId },
        });

        // Check max songs
        const party = await prisma.party.findUnique({ where: { id: partyId } });
        const count = await prisma.queueTrack.count({ where: { partyId } });
        if (party && count >= party.maxSongs) {
          socket.emit("error", { message: "Queue is full" });
          return;
        }

        // Always create a new queue entry (duplicates allowed)
        await prisma.queueTrack.create({
          data: {
            partyId,
            spotifyUri,
            title,
            artist,
            albumArt,
            durationMs,
            addedBy: participant?.displayName || "Unknown",
            addedByParticipantId: participantId,
            position: count,
          },
        });

        // Fetch updated queue
        const tracks = await prisma.queueTrack.findMany({
          where: { partyId },
          orderBy: { position: "asc" },
          include: {
            votes: { select: { participantId: true, value: true } },
          },
        });

        io.to(partyId).emit("queue:updated", { tracks });

        // If no track is currently playing, start this one (locked to prevent race)
        await withPartyLock(partyId, async () => {
          const playback = getPlaybackForClient(partyId);
          if (!playback || !playback.currentTrackId) {
            await startNextTrack(partyId, io);
          }
        });
      } catch (err) {
        console.error("Add track error:", err);
        socket.emit("error", { message: "Failed to add track" });
      }
    }
  );

  // --- Queue reorder ---
  socket.on(
    "queue:reorder",
    async (data: { partyId: string; trackIds: string[] }) => {
      const { partyId, trackIds } = data;
      try {
        // Update positions in a transaction
        await prisma.$transaction(
          trackIds.map((id, i) =>
            prisma.queueTrack.update({
              where: { id },
              data: { position: i },
            })
          )
        );

        // Fetch updated queue and broadcast
        const tracks = await prisma.queueTrack.findMany({
          where: { partyId },
          orderBy: { position: "asc" },
          include: {
            votes: { select: { participantId: true, value: true } },
          },
        });

        io.to(partyId).emit("queue:updated", { tracks });
      } catch (err) {
        console.error("Reorder error:", err);
      }
    }
  );

  // --- Queue remove ---
  socket.on(
    "queue:remove",
    async (data: { partyId: string; trackId: string }) => {
      const { partyId, trackId } = data;
      try {
        // Don't allow removing the currently playing track
        const playback = getPlaybackForClient(partyId);
        if (playback?.currentTrackId === trackId) {
          socket.emit("error", { message: "Cannot remove the currently playing track" });
          return;
        }

        // Delete related records first (no cascade configured)
        await prisma.$transaction([
          prisma.listenLog.deleteMany({ where: { trackId } }),
          prisma.trackReaction.deleteMany({ where: { trackId } }),
          prisma.vote.deleteMany({ where: { trackId } }),
          prisma.queueTrack.delete({ where: { id: trackId } }),
        ]);

        // Fetch updated queue and broadcast
        const tracks = await prisma.queueTrack.findMany({
          where: { partyId },
          orderBy: { position: "asc" },
          include: {
            votes: { select: { participantId: true, value: true } },
          },
        });

        io.to(partyId).emit("queue:updated", { tracks });
      } catch (err) {
        console.error("Remove track error:", err);
        socket.emit("error", { message: "Failed to remove track" });
      }
    }
  );

  // --- Playback controls ---
  socket.on("playback:play", async (data: { partyId: string }) => {
    await resumePlayback(data.partyId, io);
  });

  socket.on("playback:pause", async (data: { partyId: string }) => {
    await pausePlayback(data.partyId, io);
  });

  socket.on("playback:skip", async (data: { partyId: string }) => {
    await skipTrack(data.partyId, io);
  });

  socket.on("playback:previous", async (data: { partyId: string }) => {
    await previousTrack(data.partyId, io);
  });

  socket.on("playback:end-party", async (data: { partyId: string }) => {
    const participant = await prisma.participant.findFirst({
      where: { socketId: socket.id, partyId: data.partyId, isHost: true },
    });
    if (!participant) return;
    await endParty(data.partyId, io);
  });

  // --- Seek (any participant) ---
  socket.on(
    "playback:seek",
    async (data: { partyId: string; positionMs: number }) => {
      const participant = await prisma.participant.findFirst({
        where: { socketId: socket.id, partyId: data.partyId },
      });
      if (!participant) return;
      await seekPlayback(data.partyId, data.positionMs, io, socket.id);
    }
  );

  // --- Drift correction (client reports its position) ---
  socket.on(
    "playback:position-report",
    (data: { partyId: string; positionMs: number }) => {
      const correction = checkDrift(data.partyId, data.positionMs);
      if (correction) {
        // Send correction only to the reporting client
        socket.emit("playback:correct", {
          positionMs: correction.correctPositionMs,
          spotifyUri: correction.spotifyUri,
        });
      }
    }
  );

  // --- Track ended (from client, backup signal) ---
  socket.on(
    "playback:track-ended",
    async (data: { partyId: string; trackId: string }) => {
      const playback = getPlaybackForClient(data.partyId);
      if (playback?.currentTrackId === data.trackId) {
        await skipTrack(data.partyId, io);
      }
    }
  );

  // --- Voting ---
  socket.on(
    "vote:cast",
    async (data: {
      partyId: string;
      trackId: string;
      participantId: string;
      value: number;
    }) => {
      const { partyId, trackId, participantId, value } = data;

      try {
        // Find all tracks with the same spotifyUri in this party
        const votedTrack = await prisma.queueTrack.findUnique({
          where: { id: trackId },
          select: { spotifyUri: true },
        });
        if (!votedTrack) return;

        // Enforce max votes per user (only when adding a vote, not removing)
        if (value === 1) {
          const party = await prisma.party.findUnique({
            where: { id: partyId },
            select: { maxVotesPerUser: true },
          });
          if (party) {
            // Count distinct songs this user has voted for (group by spotifyUri)
            const userVotes = await prisma.vote.findMany({
              where: { participantId, value: 1, track: { partyId } },
              select: { track: { select: { spotifyUri: true } } },
            });
            const uniqueVotedSongs = new Set(userVotes.map((v) => v.track.spotifyUri));
            // Don't count the current song if already voted (re-vote scenario)
            uniqueVotedSongs.delete(votedTrack.spotifyUri);
            if (uniqueVotedSongs.size >= party.maxVotesPerUser) {
              socket.emit("error", { message: `You can only vote for ${party.maxVotesPerUser} songs` });
              return;
            }
          }
        }

        const duplicates = await prisma.queueTrack.findMany({
          where: { partyId, spotifyUri: votedTrack.spotifyUri },
          select: { id: true },
        });

        // Upsert vote across all duplicate tracks
        await prisma.$transaction(
          duplicates.map((dup) =>
            prisma.vote.upsert({
              where: {
                trackId_participantId: { trackId: dup.id, participantId },
              },
              create: { trackId: dup.id, participantId, value },
              update: { value },
            })
          )
        );

        // Active participants = anyone who has voted or reacted in this party
        const activeParticipantCount = await getActiveParticipantCount(partyId);

        // Recompute score and broadcast for each duplicate
        for (const dup of duplicates) {
          const track = await prisma.queueTrack.findUnique({
            where: { id: dup.id },
            select: { addedByParticipantId: true },
          });
          const addedBy = track?.addedByParticipantId ?? null;
          const votes = await prisma.vote.findMany({ where: { trackId: dup.id } });
          const [commentCount, emojiCount, selfCommentCount, selfEmojiCount] = await getReactionCounts(dup.id, addedBy);

          const score = computeScore({
            votes: votes.map((v) => ({
              participantId: v.participantId,
              value: v.value,
            })),
            commentCount,
            emojiCount,
            selfCommentCount,
            selfEmojiCount,
            addedByParticipantId: addedBy,
            activeParticipantCount,
          });

          await prisma.queueTrack.update({
            where: { id: dup.id },
            data: { score },
          });

          io.to(partyId).emit("scores:updated", {
            trackId: dup.id,
            score,
            voteCount: votes.filter((v) => v.value === 1).length,
            votes: votes.map((v) => ({
              participantId: v.participantId,
              value: v.value,
            })),
          });
        }
      } catch (err) {
        console.error("Vote error:", err);
      }
    }
  );

  // --- Reactions (persisted, capped at 3 per user per track) ---
  socket.on(
    "reaction:send",
    async (data: {
      partyId: string;
      participantId: string;
      user: string;
      content: string;
      type: "emoji" | "text";
    }) => {
      // Persist if there's an active track
      const playback = getPlaybackForClient(data.partyId);
      if (playback?.currentTrackId && data.participantId) {
        const count = await prisma.trackReaction.count({
          where: {
            trackId: playback.currentTrackId,
            participantId: data.participantId,
          },
        });
        if (count < 3) {
          await prisma.trackReaction.create({
            data: {
              trackId: playback.currentTrackId,
              participantId: data.participantId,
              content: data.content,
              type: data.type,
            },
          }).catch(() => {});

          // Recompute score so reactions are reflected in real-time
          const trackId = playback.currentTrackId;
          const track = await prisma.queueTrack.findUnique({
            where: { id: trackId },
            select: { addedByParticipantId: true },
          });
          const addedBy = track?.addedByParticipantId ?? null;
          const votes = await prisma.vote.findMany({ where: { trackId } });
          const [commentCount, emojiCount, selfCommentCount, selfEmojiCount] = await getReactionCounts(trackId, addedBy);
          const activeParticipantCount = await getActiveParticipantCount(data.partyId);

          const score = computeScore({
            votes: votes.map((v) => ({
              participantId: v.participantId,
              value: v.value,
            })),
            commentCount,
            emojiCount,
            selfCommentCount,
            selfEmojiCount,
            addedByParticipantId: addedBy,
            activeParticipantCount,
          });

          await prisma.queueTrack.update({
            where: { id: trackId },
            data: { score },
          });

          io.to(data.partyId).emit("scores:updated", {
            trackId,
            score,
            voteCount: votes.filter((v) => v.value === 1).length,
            votes: votes.map((v) => ({
              participantId: v.participantId,
              value: v.value,
            })),
          });
        }
      }

      socket.to(data.partyId).emit("reaction:new", {
        user: data.user,
        content: data.content,
        type: data.type,
      });
    }
  );

  // --- Listen time logging ---
  socket.on(
    "listen:log",
    async (data: {
      partyId: string;
      trackId: string;
      participantId: string;
      listenedMs: number;
      durationMs: number;
    }) => {
      try {
        await prisma.listenLog.upsert({
          where: {
            trackId_participantId: {
              trackId: data.trackId,
              participantId: data.participantId,
            },
          },
          create: {
            trackId: data.trackId,
            participantId: data.participantId,
            listenedMs: data.listenedMs,
            durationMs: data.durationMs,
          },
          update: {
            listenedMs: data.listenedMs,
          },
        });
      } catch (err) {
        console.error("Listen log error:", err);
      }
    }
  );

  // --- Disconnect ---
  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);

    // Clear socket ID on participant
    await prisma.participant
      .updateMany({
        where: { socketId: socket.id },
        data: { socketId: null },
      })
      .catch(() => {});
  });
});

server.listen(Number(env.PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${env.PORT}`);
});
