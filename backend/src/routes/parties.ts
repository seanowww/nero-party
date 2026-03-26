import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// Random color for avatars
const COLORS = [
  "#6366f1", "#ec4899", "#10b981", "#f59e0b",
  "#8b5cf6", "#ef4444", "#06b6d4", "#d946ef",
];

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/parties — create a party
router.post("/", async (req, res) => {
  const { name, hostName, maxSongs, timeLimitMin, maxVotesPerUser } = req.body;

  if (!name || !hostName) {
    res.status(400).json({ error: "name and hostName required" });
    return;
  }

  try {
    // Generate unique join code
    let code = generateCode();
    while (await prisma.party.findUnique({ where: { code } })) {
      code = generateCode();
    }

    const party = await prisma.party.create({
      data: {
        name,
        code,
        hostId: "", // will be set after participant creation
        maxSongs: maxSongs || 20,
        maxVotesPerUser: maxVotesPerUser ?? 5,
        timeLimitMin: timeLimitMin || null,
      },
    });

    // Create host as first participant
    const host = await prisma.participant.create({
      data: {
        partyId: party.id,
        displayName: hostName,
        color: randomColor(),
        isHost: true,
      },
    });

    // Update party with host ID
    await prisma.party.update({
      where: { id: party.id },
      data: { hostId: host.id },
    });

    res.json({
      id: party.id,
      code: party.code,
      participantId: host.id,
    });
  } catch (err) {
    console.error("Create party error:", err);
    res.status(500).json({ error: "Failed to create party" });
  }
});

// POST /api/parties/:code/join — join a party by code
router.post("/:code/join", async (req, res) => {
  const { code } = req.params;
  const { displayName } = req.body;

  if (!displayName) {
    res.status(400).json({ error: "displayName required" });
    return;
  }

  try {
    const party = await prisma.party.findUnique({ where: { code } });

    if (!party) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    if (party.status === "ended") {
      res.status(410).json({ error: "Party has ended" });
      return;
    }

    // Upsert — allow rejoining
    const participant = await prisma.participant.upsert({
      where: {
        partyId_displayName: {
          partyId: party.id,
          displayName,
        },
      },
      create: {
        partyId: party.id,
        displayName,
        color: randomColor(),
      },
      update: {},
    });

    res.json({
      partyId: party.id,
      participantId: participant.id,
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        color: participant.color,
        isHost: participant.isHost,
        isPremium: participant.isPremium,
      },
    });
  } catch (err) {
    console.error("Join party error:", err);
    res.status(500).json({ error: "Failed to join party" });
  }
});

// GET /api/parties/:id — get full party state
router.get("/:id", async (req, res) => {
  try {
    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
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
            votes: {
              select: { participantId: true, value: true },
            },
          },
        },
      },
    });

    if (!party) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    // Strip BigInt fields before JSON serialization
    const { startedAt: _sa, isPlaying: _ip, positionMs: _pm, ...partyData } = party;
    res.json(partyData);
  } catch (err) {
    console.error("Get party error:", err);
    res.status(500).json({ error: "Failed to get party" });
  }
});

export default router;
