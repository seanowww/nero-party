import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import {
  getAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  getUserProfile,
} from "../lib/spotify.js";
import { env } from "../env.js";

const router = Router();

// GET /auth/spotify/login?participantId=X&partyId=Y
router.get("/spotify/login", (req, res) => {
  const { participantId, partyId } = req.query;

  if (!participantId || !partyId) {
    res.status(400).json({ error: "participantId and partyId required" });
    return;
  }

  const state = Buffer.from(
    JSON.stringify({ participantId, partyId })
  ).toString("base64url");

  res.redirect(getAuthorizeUrl(state));
});

// GET /auth/spotify/callback?code=...&state=...
router.get("/spotify/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    res.redirect(`${env.FRONTEND_URL}?auth=error`);
    return;
  }

  try {
    const { participantId, partyId } = JSON.parse(
      Buffer.from(state as string, "base64url").toString()
    );

    const tokens = await exchangeCode(code as string);
    const profile = await getUserProfile(tokens.access_token);

    await prisma.participant.update({
      where: { id: participantId },
      data: {
        spotifyToken: tokens.access_token,
        spotifyRefresh: tokens.refresh_token,
        spotifyUserId: profile.id,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isPremium: profile.product === "premium",
      },
    });

    // Check if another participant in this party is using the same Spotify account
    const duplicate = await prisma.participant.findFirst({
      where: {
        partyId,
        spotifyUserId: profile.id,
        id: { not: participantId },
      },
      select: { displayName: true },
    });

    const authStatus = profile.product === "premium" ? "success" : "no-premium";
    const dupeParam = duplicate ? `&spotifyDupe=${encodeURIComponent(duplicate.displayName)}` : "";
    res.redirect(
      `${env.FRONTEND_URL}/party/${partyId}?auth=${authStatus}&participantId=${participantId}${dupeParam}`
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`${env.FRONTEND_URL}?auth=error`);
  }
});

// GET /auth/spotify/token?participantId=X
router.get("/spotify/token", async (req, res) => {
  const { participantId } = req.query;

  if (!participantId) {
    res.status(400).json({ error: "participantId required" });
    return;
  }

  try {
    const participant = await prisma.participant.findUnique({
      where: { id: participantId as string },
    });

    if (!participant?.spotifyToken) {
      res.status(401).json({ error: "Not authenticated with Spotify" });
      return;
    }

    // Check if token needs refresh
    const needsRefresh =
      participant.tokenExpiresAt &&
      participant.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (needsRefresh && participant.spotifyRefresh) {
      const refreshed = await refreshAccessToken(participant.spotifyRefresh);

      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          spotifyToken: refreshed.access_token,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });

      res.json({
        accessToken: refreshed.access_token,
        expiresIn: refreshed.expires_in,
        isPremium: participant.isPremium,
      });
      return;
    }

    res.json({
      accessToken: participant.spotifyToken,
      expiresIn: participant.tokenExpiresAt
        ? Math.floor(
            (participant.tokenExpiresAt.getTime() - Date.now()) / 1000
          )
        : 3600,
      isPremium: participant.isPremium,
    });
  } catch (err) {
    console.error("Token endpoint error:", err);
    res.status(500).json({ error: "Failed to get token" });
  }
});

export default router;
