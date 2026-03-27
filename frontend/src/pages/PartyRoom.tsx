import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import TopBar from "../components/party/TopBar";
import PartyHeader from "../components/party/PartyHeader";
import NowPlaying from "../components/party/NowPlaying";
import PlayerControls from "../components/party/PlayerControls";
import PeopleDrawer from "../components/party/PeopleDrawer";
import Reactions from "../components/party/Reactions";
import type { Reaction } from "../components/party/Reactions";
import ReactionInput from "../components/party/ReactionInput";
import QueueDrawer from "../components/party/QueueDrawer";
import SearchModal from "../components/party/SearchModal";
import VoteControl from "../components/party/VoteControl";
import PartyOver from "../components/party/PartyOver";
import TimeWarning from "../components/party/TimeWarning";
import AlbumCarousel from "../components/party/AlbumCarousel";
import { socket } from "../lib/socket";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { getSpotifyLoginUrl } from "../lib/api";
import type { QueueTrack, SpotifyTrackResult } from "../lib/api";
import { useAlbumColor } from "../hooks/useAlbumColor";

interface PlaybackInfo {
  trackId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  albumArt: string;
  durationMs: number;
  startedAt: number;
  positionMs: number;
  isPlaying?: boolean;
}

// Fallback color when no Spotify color is available
const DEFAULT_COLOR = "#d4a574";

/** Full-viewport cinematic glow that washes the room in the album's dominant color */
function ConcertGlow({ artworkUrl, isPlaying }: { artworkUrl: string; isPlaying: boolean }) {
  const color = useAlbumColor(artworkUrl);
  const hasArt = !!artworkUrl;

  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
      {/* Idle warm glow — fades out when artwork arrives */}
      <div
        className="absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 w-[120%] h-[70%] rounded-full transition-opacity duration-[2000ms] ease-in-out"
        style={{
          background: `radial-gradient(ellipse at center, ${DEFAULT_COLOR} 0%, transparent 60%)`,
          filter: "blur(100px)",
          opacity: hasArt ? 0 : 0.08,
          animation: hasArt ? "none" : "breathe 6s ease-in-out infinite",
        }}
      />

      {/* Primary wash — large soft bloom from center-top */}
      <div
        className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[140%] h-[80%] rounded-full transition-all duration-[2500ms] ease-in-out"
        style={{
          background: `radial-gradient(ellipse at center, ${color} 0%, transparent 65%)`,
          filter: "blur(80px)",
          opacity: hasArt ? (isPlaying ? 0.15 : 0.05) : 0,
        }}
      />
      {/* Secondary wash — lower, wider, dimmer for depth */}
      <div
        className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 w-[180%] h-[60%] rounded-full transition-all duration-[3000ms] ease-in-out"
        style={{
          background: `radial-gradient(ellipse at center, ${color} 0%, transparent 55%)`,
          filter: "blur(120px)",
          opacity: hasArt ? (isPlaying ? 0.08 : 0.02) : 0,
        }}
      />
      {/* Edge spill — subtle color on the edges like stage lights hitting walls */}
      <div
        className="absolute inset-0 transition-opacity duration-[2500ms] ease-in-out"
        style={{
          background: `
            radial-gradient(ellipse at 10% 50%, ${color}, transparent 50%),
            radial-gradient(ellipse at 90% 50%, ${color}, transparent 50%)
          `,
          filter: "blur(60px)",
          opacity: hasArt ? (isPlaying ? 0.06 : 0.01) : 0,
        }}
      />
    </div>
  );
}

export default function PartyRoom() {
  const { id: partyId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Session state — stored in localStorage for persistence across OAuth redirects
  const [participantId, setParticipantId] = useState<string | null>(() => {
    return (
      searchParams.get("participantId") ||
      localStorage.getItem(`nero-participant-${partyId}`)
    );
  });

  // Party state
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [spotifySettled, setSpotifySettled] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyCode, setPartyCode] = useState("");
  const [partyStatus, setPartyStatus] = useState("active");
  const [partyCreatedAt, setPartyCreatedAt] = useState<number | null>(null);
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(null);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState<number>(5);
  const [sessionTime, setSessionTime] = useState("--:--");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [endedData, setEndedData] = useState<{
    winner: { rank: number; id: string; title: string; artist: string; albumArt: string; addedBy: string; totalScore: number; voteCount: number; reactionCount: number } | null;
    rankings: { rank: number; id: string; title: string; artist: string; albumArt: string; addedBy: string; totalScore: number; voteCount: number; reactionCount: number }[];
  } | null>(null);
  const [participants, setParticipants] = useState<
    { id: string; displayName: string; color: string; isHost: boolean; isPremium: boolean }[]
  >([]);
  const [tracks, setTracks] = useState<QueueTrack[]>([]);
  const [currentPlayback, setCurrentPlayback] = useState<PlaybackInfo | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const reactionIdRef = useRef(0);
  const trackStartTimeRef = useRef<number>(Date.now());
  const lastLoggedTrackRef = useRef<string | null>(null);
  const lastPlayedIndexRef = useRef<number>(-1);


  // Shared Spotify account warning
  const [spotifyDupeUser, setSpotifyDupeUser] = useState<string | null>(() => {
    return searchParams.get("spotifyDupe");
  });

  // UI state
  const [queueOpen, setQueueOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekingUntilRef = useRef(0); // timestamp until which we ignore progress ticks

  // Spotify player
  const {
    isReady: spotifyReady,
    deviceLost,
    playerState,
    playTrack,
    pause: spotifyPause,
    seek: spotifySeek,
    reclaim,
  } = useSpotifyPlayer(participantId);

  // User is "connected" if the SDK is ready OR if they just returned from OAuth
  const hasAuthReturn = searchParams.get("auth") === "success";
  const isSpotifyConnected = spotifyReady || hasAuthReturn;

  // Refs for SDK functions (stable references for socket handlers)
  const playTrackRef = useRef(playTrack);
  playTrackRef.current = playTrack;
  const spotifyPauseRef = useRef(spotifyPause);
  spotifyPauseRef.current = spotifyPause;
  const spotifySeekRef = useRef(spotifySeek);
  spotifySeekRef.current = spotifySeek;
  const playerStateRef = useRef(playerState);
  const playerStateAtRef = useRef<number>(Date.now());
  // Track when playerState was last received so we can interpolate position
  if (playerState !== playerStateRef.current) {
    playerStateRef.current = playerState;
    playerStateAtRef.current = Date.now();
  }
  const lastStartedTrackRef = useRef<string | null>(null);
  const trackEndEmittedRef = useRef<string | null>(null);

  /** Get the interpolated SDK position right now (accounts for time since last state event) */
  const getInterpolatedPosition = useCallback((): number | null => {
    const ps = playerStateRef.current;
    if (!ps) return null;
    if (ps.paused) return ps.position;
    return ps.position + (Date.now() - playerStateAtRef.current);
  }, []);

  // Delay showing SpotifyConnect until SDK has had time to initialize
  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => setSpotifySettled(true), 1500);
    return () => clearTimeout(timer);
  }, [initialLoaded]);

  // Persist participantId
  useEffect(() => {
    if (participantId && partyId) {
      localStorage.setItem(`nero-participant-${partyId}`, participantId);
    }
  }, [participantId, partyId]);

  // Update participantId from URL params (after OAuth redirect)
  useEffect(() => {
    const urlPid = searchParams.get("participantId");
    if (urlPid) {
      setParticipantId(urlPid);
    }
  }, [searchParams]);

  // Session timer — ticks every second showing elapsed time since party creation
  useEffect(() => {
    if (!partyCreatedAt) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - partyCreatedAt) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setSessionTime(
        `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [partyCreatedAt]);

  // Connect socket and join party
  useEffect(() => {
    if (!partyId || !participantId) return;

    socket.connect();

    socket.emit("join:party", { partyId, participantId });

    socket.on("party:state", (state) => {
      setInitialLoaded(true);
      setPartyName(state.name);
      setPartyCode(state.code);
      setPartyStatus(state.status);
      setParticipants(state.participants);
      setTracks(state.tracks);
      if (state.createdAt) {
        setPartyCreatedAt(new Date(state.createdAt).getTime());
      }
      setTimeLimitMin(state.timeLimitMin ?? null);
      setMaxVotesPerUser(state.maxVotesPerUser ?? 5);

      if (state.playback?.currentTrackId) {
        setCurrentPlayback(state.playback);
        setIsPlaying(state.playback.isPlaying ?? false);
        setDuration(Math.floor(state.playback.durationMs / 1000));
        const pos = state.playback.isPlaying
          ? state.playback.positionMs + (Date.now() - state.playback.startedAt)
          : state.playback.positionMs;
        setCurrentTime(Math.floor(Math.max(0, pos) / 1000));
      } else {
        // Reconstruct last played index from track data (survives reload)
        const lastIdx = state.tracks.reduce(
          (last: number, t: { played: boolean }, i: number) =>
            t.played ? i : last,
          -1
        );
        if (lastIdx >= 0) {
          lastPlayedIndexRef.current = lastIdx;
        }
      }
    });

    socket.on("participants:updated", ({ participants: p }) => {
      setParticipants(p);
    });

    socket.on("queue:updated", ({ tracks: t }) => {
      setTracks(t);
    });

    socket.on("playback:play", (data: PlaybackInfo) => {
      trackStartTimeRef.current = Date.now();
      lastLoggedTrackRef.current = null;
      trackEndEmittedRef.current = null;
      setCurrentPlayback(data);
      setIsPlaying(true);
      setDuration(Math.floor(data.durationMs / 1000));
      setCurrentTime(0);
    });

    socket.on("playback:pause", (data: { positionMs: number }) => {
      setIsPlaying(false);
      setCurrentTime(Math.floor(data.positionMs / 1000));
      spotifySeekRef.current(data.positionMs);
      spotifyPauseRef.current();
    });

    socket.on("playback:resume", (data: { spotifyUri: string; trackId: string; positionMs: number; startedAt: number }) => {
      // Adjust for network latency: account for time elapsed since server sent this
      const adjustedPos = data.positionMs + Math.max(0, Date.now() - data.startedAt);
      setIsPlaying(true);
      setCurrentTime(Math.floor(adjustedPos / 1000));
      // Start playback from authoritative server position; don't rely on prior local loaded state
      playTrackRef.current(data.spotifyUri, adjustedPos);
    });

    socket.on("playback:seek", (data: { positionMs: number; spotifyUri: string }) => {
      // If we initiated this seek, just update UI — don't double-seek the SDK
      if (Date.now() < seekingUntilRef.current) {
        seekingUntilRef.current = 0;
        setCurrentTime(Math.floor(data.positionMs / 1000));
        return;
      }
      seekingUntilRef.current = 0;
      setCurrentTime(Math.floor(data.positionMs / 1000));
      spotifySeekRef.current(data.positionMs);
    });

    socket.on("playback:queue-empty", () => {
      setCurrentPlayback(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      spotifyPauseRef.current();
    });

    socket.on("scores:updated", ({ trackId, score, votes }: { trackId: string; score: number; votes: { participantId: string; value: number }[] }) => {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId ? { ...t, score, votes } : t
        )
      );
    });

    socket.on("reaction:new", (data: { user: string; content: string; type: "emoji" | "text" }) => {
      const id = `r-${reactionIdRef.current++}`;
      setReactions((prev) => [...prev.slice(-10), { id, ...data }]);
    });

    socket.on("party:ended", (data) => {
      setPartyStatus("ended");
      setEndedData(data);
      spotifyPauseRef.current();
    });

    // Drift correction: server sends when drift > 2s, but only apply for large
    // drifts because seek() causes an audible audio gap while the SDK rebuffers
    socket.on("playback:correct", (data: { positionMs: number; spotifyUri: string }) => {
      const ps = playerStateRef.current;
      if (!ps) return;
      // Use interpolated position for accurate comparison
      const localPos = ps.paused
        ? ps.position
        : ps.position + (Date.now() - playerStateAtRef.current);
      const drift = Math.abs(data.positionMs - localPos);
      if (drift > 2000) {
        spotifySeekRef.current(data.positionMs);
        setCurrentTime(Math.floor(data.positionMs / 1000));
      }
    });

    return () => {
      socket.off("party:state");
      socket.off("participants:updated");
      socket.off("queue:updated");
      socket.off("playback:play");
      socket.off("playback:pause");
      socket.off("playback:resume");
      socket.off("playback:seek");
      socket.off("playback:queue-empty");
      socket.off("scores:updated");
      socket.off("reaction:new");
      socket.off("party:ended");
      socket.off("playback:correct");
      socket.disconnect();
    };
  }, [partyId, participantId]);

  // Sync SDK playback with socket events — only fires when the track actually changes
  useEffect(() => {
    if (!currentPlayback || !spotifyReady) return;
    if (lastStartedTrackRef.current === currentPlayback.trackId) return;
    lastStartedTrackRef.current = currentPlayback.trackId;
    // Do not auto-start audio for late joiners when party is currently paused.
    // Playback will begin on the next server "playback:resume" event.
    if (currentPlayback.isPlaying === false) return;
    const pos = currentPlayback.positionMs + (Date.now() - currentPlayback.startedAt);
    playTrack(currentPlayback.spotifyUri, Math.max(0, pos));
  }, [currentPlayback?.trackId, spotifyReady]);

  // Sync duration and track-end from SDK (position is handled by the tick interval,
  // isPlaying is set by socket events which represent the authoritative server state)
  useEffect(() => {
    if (playerState) {
      setDuration(Math.floor(playerState.duration / 1000));

      // Detect track end (backup signal — server has its own timer).
      // Guard with trackEndEmittedRef to prevent duplicate emissions during
      // SDK buffering where paused flips briefly to true.
      if (
        playerState.paused &&
        playerState.duration > 0 &&
        playerState.position >= playerState.duration - 1000 &&
        currentPlayback?.trackId &&
        trackEndEmittedRef.current !== currentPlayback.trackId
      ) {
        trackEndEmittedRef.current = currentPlayback.trackId;
        socket.emit("playback:track-ended", {
          partyId,
          trackId: currentPlayback.trackId,
        });
      }
    }
  }, [playerState]);

  // Progress bar tick — single stable interval, interpolates from last SDK position
  useEffect(() => {
    if (!isPlaying || !currentPlayback) return;

    const interval = setInterval(() => {
      // Skip ticks while a seek is in-flight so optimistic UI isn't overwritten
      if (Date.now() < seekingUntilRef.current) return;

      const pos = getInterpolatedPosition();
      if (spotifyReady && pos !== null) {
        // Interpolated SDK position (smooth, accounts for time since last state event)
        setCurrentTime(Math.floor(pos / 1000));
      } else {
        // Estimate from server timestamp
        const elapsed = currentPlayback.positionMs + (Date.now() - currentPlayback.startedAt);
        setCurrentTime(Math.min(Math.floor(elapsed / 1000), duration));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, spotifyReady, currentPlayback, duration, getInterpolatedPosition]);

  // Drift correction — report interpolated position to server every 12 seconds
  useEffect(() => {
    if (!isPlaying || !spotifyReady || !partyId) return;

    const interval = setInterval(() => {
      const pos = getInterpolatedPosition();
      if (pos !== null) {
        socket.emit("playback:position-report", {
          partyId,
          positionMs: pos,
        });
      }
    }, 12_000);

    return () => clearInterval(interval);
  }, [isPlaying, spotifyReady, partyId, getInterpolatedPosition]);

  // Listen time helper — call before track changes
  const emitListenLog = useCallback(() => {
    if (!partyId || !participantId || !currentPlayback?.trackId) return;
    if (lastLoggedTrackRef.current === currentPlayback.trackId) return;
    lastLoggedTrackRef.current = currentPlayback.trackId;

    const listenedMs = Date.now() - trackStartTimeRef.current;
    socket.emit("listen:log", {
      partyId,
      trackId: currentPlayback.trackId,
      participantId,
      listenedMs: Math.max(0, listenedMs),
      durationMs: currentPlayback.durationMs,
    });
  }, [partyId, participantId, currentPlayback?.trackId, currentPlayback?.durationMs]);

  // Handlers
  const handlePlayPause = useCallback(() => {
    if (!partyId) return;
    if (isPlaying) {
      socket.emit("playback:pause", { partyId });
    } else {
      socket.emit("playback:play", { partyId });
    }
  }, [partyId, isPlaying]);

  const handleSkip = useCallback(() => {
    if (!partyId) return;
    emitListenLog();
    socket.emit("playback:skip", { partyId });
  }, [partyId, emitListenLog]);

  const handlePrevious = useCallback(() => {
    if (!partyId) return;
    emitListenLog();
    socket.emit("playback:previous", { partyId });
  }, [partyId, emitListenLog]);

  const handleSeek = useCallback(
    (time: number) => {
      if (!partyId) return;
      const positionMs = Math.floor(time * 1000);
      seekingUntilRef.current = Date.now() + 2000; // ignore ticks for 2s
      setCurrentTime(time); // optimistic UI
      spotifySeek(positionMs); // seek SDK immediately — don't wait for server round-trip
      socket.emit("playback:seek", { partyId, positionMs }); // sync other clients
    },
    [partyId, spotifySeek]
  );

  const handleAddTrack = useCallback(
    (track: SpotifyTrackResult) => {
      if (!partyId || !participantId) return;
      socket.emit("queue:add", {
        partyId,
        participantId,
        spotifyUri: track.spotifyUri,
        title: track.title,
        artist: track.artist,
        albumArt: track.albumArt,
        durationMs: track.durationMs,
      });
    },
    [partyId, participantId]
  );

  const handleReact = useCallback(
    (r: Omit<Reaction, "id">) => {
      if (!partyId) return;
      // Add locally
      const id = `r-${reactionIdRef.current++}`;
      setReactions((prev) => [...prev.slice(-10), { id, ...r }]);
      // Broadcast
      socket.emit("reaction:send", {
        partyId,
        participantId,
        user: r.user,
        content: r.content,
        type: r.type,
      });
    },
    [partyId, participantId]
  );

  const handleInvite = useCallback(() => {
    if (partyCode) {
      navigator.clipboard.writeText(
        `${window.location.origin}/join/${partyCode}`
      );
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  }, [partyCode]);

  const handleCopyCode = useCallback(() => {
    if (partyCode) {
      navigator.clipboard.writeText(partyCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [partyCode]);

  const handleLeaveParty = useCallback(() => {
    socket.disconnect();
    if (partyId) localStorage.removeItem(`nero-participant-${partyId}`);
    navigate("/");
  }, [partyId, navigate]);

  const handleEndParty = useCallback(() => {
    if (!partyId) return;
    socket.emit("playback:end-party", { partyId });
  }, [partyId]);

  const isHost = participants.some(
    (p) => p.id === participantId && p.isHost
  );
  console.log("[DEBUG isHost]", { participantId, participants: participants.map(p => ({ id: p.id, isHost: p.isHost })), isHost });

  // Derive current/previous/next tracks for NowPlaying
  const currentTrackIndex = tracks.findIndex(
    (t) => t.id === currentPlayback?.trackId
  );
  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  // Remember last played index for queue-exhausted state
  if (currentTrackIndex >= 0) {
    lastPlayedIndexRef.current = currentTrackIndex;
  }

  const previousTrack = currentTrackIndex > 0 ? tracks[currentTrackIndex - 1] : undefined;
  const nextTrack =
    currentTrackIndex >= 0 && currentTrackIndex < tracks.length - 1
      ? tracks[currentTrackIndex + 1]
      : undefined;
  const deeperPrevious = currentTrackIndex > 1
    ? tracks.slice(0, currentTrackIndex - 1).reverse()
    : [];
  const deeperNext = currentTrackIndex >= 0
    ? tracks.slice(currentTrackIndex + 2)
    : [];

  // Queue-exhausted: tracks were played but nothing left
  const isQueueExhausted = !currentTrack && tracks.length > 0 && lastPlayedIndexRef.current >= 0;
  const lastIdx = lastPlayedIndexRef.current;
  const exhaustedTrack = isQueueExhausted ? tracks[lastIdx] : null;
  const exhaustedPrev = isQueueExhausted && lastIdx > 0 ? tracks[lastIdx - 1] : undefined;
  const exhaustedDeeperPrev = isQueueExhausted && lastIdx > 1
    ? tracks.slice(0, lastIdx - 1).reverse() : [];


  const toNowPlayingTrack = (t: QueueTrack) => ({
    title: t.title,
    artist: t.artist,
    artwork: t.albumArt,
    color: DEFAULT_COLOR,
  });

  const userVotesUsed = participantId
    ? new Set(
        tracks
          .filter((t) => t.votes.some((v) => v.participantId === participantId && v.value === 1))
          .map((t) => t.spotifyUri)
      ).size
    : 0;

  const queueTracks = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    artwork: t.albumArt,
    addedBy: t.addedBy,
    isPlaying: t.id === currentPlayback?.trackId,
    voted: participantId
      ? t.votes.some((v) => v.participantId === participantId && v.value === 1)
      : false,
  }));

  return (
    <div className="fixed inset-0 bg-void flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle background grain */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* Contour lines radiating from corners — behind all content */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          zIndex: -1,
          opacity: 0.18,
          filter: "blur(0.4px)",
          maskImage: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 0%, transparent 75%, rgba(0,0,0,0.3) 90%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 0%, transparent 75%, rgba(0,0,0,0.3) 90%, black 100%)",
        }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1400 900" fill="none" preserveAspectRatio="xMidYMid slice">
          {/* Top-left corner cluster */}
          {Array.from({ length: 10 }).map((_, i) => {
            const r = 80 + i * 55;
            const wobX = Math.sin(i * 1.3) * 15;
            const wobY = Math.cos(i * 0.9) * 10;
            return <ellipse key={`tl-${i}`} cx={-40 + wobX} cy={-30 + wobY} rx={r * 1.1} ry={r * 0.85} stroke="white" strokeWidth="0.5" />;
          })}
          {/* Top-right corner cluster */}
          {Array.from({ length: 8 }).map((_, i) => {
            const r = 100 + i * 60;
            const wobX = Math.cos(i * 1.1) * 12;
            const wobY = Math.sin(i * 0.7) * 18;
            return <ellipse key={`tr-${i}`} cx={1440 + wobX} cy={-60 + wobY} rx={r * 0.9} ry={r} stroke="white" strokeWidth="0.45" />;
          })}
          {/* Bottom-left cluster */}
          {Array.from({ length: 9 }).map((_, i) => {
            const r = 70 + i * 50;
            const wobX = Math.sin(i * 0.6) * 20;
            const wobY = Math.cos(i * 1.4) * 12;
            return <ellipse key={`bl-${i}`} cx={-80 + wobX} cy={940 + wobY} rx={r * 1.2} ry={r * 0.75} stroke="white" strokeWidth="0.45" />;
          })}
          {/* Bottom-right cluster */}
          {Array.from({ length: 7 }).map((_, i) => {
            const r = 90 + i * 65;
            const wobX = Math.cos(i * 0.8) * 14;
            const wobY = Math.sin(i * 1.2) * 16;
            return <ellipse key={`br-${i}`} cx={1480 + wobX} cy={960 + wobY} rx={r * 0.95} ry={r * 1.05} stroke="white" strokeWidth="0.5" />;
          })}
          {/* Loose arcs drifting along edges */}
          <ellipse cx={700} cy={-120} rx={520} ry={180} stroke="white" strokeWidth="0.4" />
          <ellipse cx={680} cy={-120} rx={440} ry={150} stroke="white" strokeWidth="0.35" />
          <ellipse cx={700} cy={1020} rx={480} ry={160} stroke="white" strokeWidth="0.4" />
          <ellipse cx={720} cy={1020} rx={380} ry={130} stroke="white" strokeWidth="0.35" />
        </svg>
      </div>

      {/* Cinematic concert glow — full viewport wash from album color */}
      <ConcertGlow
        artworkUrl={currentTrack?.albumArt || exhaustedTrack?.albumArt || ""}
        isPlaying={isPlaying}
      />

      {/* HUD layer */}
      <TopBar onLeave={handleLeaveParty} onEndParty={handleEndParty} isHost={isHost} />
      <TimeWarning partyCreatedAt={partyCreatedAt} timeLimitMin={timeLimitMin} />
      <PartyHeader
        partyName={partyName || "Loading..."}
        partyCode={partyCode}
        timeRemaining={sessionTime}
        onQueueToggle={() => setQueueOpen(true)}
        onInvite={handleInvite}
        inviteCopied={inviteCopied}
        onCopyCode={handleCopyCode}
        codeCopied={codeCopied}
        onPeopleToggle={() => setPeopleOpen(true)}
        participantCount={participants.length}
      />
      <Reactions reactions={reactions} />
      <ReactionInput onReact={handleReact} userName={participants.find(p => p.id === participantId)?.displayName} />



      {/* Device conflict toast */}
      {deviceLost && isSpotifyConnected && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 fade-in">
          <div className="flex items-center gap-3 bg-surface border border-white/[0.06] rounded-xl px-4 py-3 shadow-lg">
            <span className="text-warm-muted text-xs font-light">
              Playback moved to another device
            </span>
            <button
              onClick={reclaim}
              className="text-amber text-xs font-medium hover:text-amber/80 transition-colors whitespace-nowrap"
            >
              Listen here
            </button>
          </div>
        </div>
      )}

      {/* Shared Spotify account warning */}
      {spotifyDupeUser && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 fade-in w-[calc(100%-2rem)] sm:w-auto max-w-md">
          <div className="flex items-center gap-3 bg-surface border border-amber/20 rounded-xl px-4 py-3 shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4a574" strokeWidth="2" className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-warm-muted text-xs font-light">
              Same Spotify account as {spotifyDupeUser} — only one of you will hear audio
            </span>
            <button
              onClick={() => setSpotifyDupeUser(null)}
              className="text-warm-muted/50 hover:text-warm-muted transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Spotify gate — full-screen with album carousel background */}
      {spotifySettled && !isSpotifyConnected && participantId && partyId && (
        <div className="fixed inset-0 z-30">
          <AlbumCarousel />
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="pointer-events-auto text-center flex flex-col items-center gap-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(29, 185, 84, 0.25)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#1ed760">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-4">
                <p className="text-[15px] font-light tracking-wide" style={{ color: "#c8c4bc" }}>
                  Connect to join the party
                </p>
                <a
                  href={getSpotifyLoginUrl(participantId, partyId)}
                  className="inline-block px-7 py-3 rounded-full border text-[14px] font-medium tracking-wide hover:scale-[1.05] transition-all duration-300"
                  style={{
                    backgroundColor: "rgba(30, 215, 96, 0.18)",
                    borderColor: "rgba(30, 215, 96, 0.35)",
                    color: "#1ed760",
                    animation: "ctaPulse 2.5s ease-in-out infinite",
                  }}
                >
                  Connect Spotify
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center stage — hidden when Spotify gate is active or still settling */}
      {spotifySettled && isSpotifyConnected && (
      <div className="relative z-10 flex flex-col items-center gap-6">
        {currentTrack ? (
          <>
            <NowPlaying
              current={toNowPlayingTrack(currentTrack)}
              previous={previousTrack ? toNowPlayingTrack(previousTrack) : undefined}
              next={nextTrack ? toNowPlayingTrack(nextTrack) : undefined}
              deeperPrevious={deeperPrevious.map(toNowPlayingTrack)}
              deeperNext={deeperNext.map(toNowPlayingTrack)}
              onPrevious={handlePrevious}
              onNext={handleSkip}
              onAddSong={() => setSearchOpen(true)}
              isPlaying={isPlaying}
            />
            {participantId && (
              <VoteControl
                key={currentTrack.id}
                partyId={partyId!}
                trackId={currentTrack.id}
                participantId={participantId}
                currentVote={
                  currentTrack.votes.find((v) => v.participantId === participantId)
                    ?.value ?? null
                }
                votesUsed={userVotesUsed}
                maxVotes={maxVotesPerUser}
                onReact={handleReact}
                userName={participants.find(p => p.id === participantId)?.displayName}
              />
            )}
            <PlayerControls
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onPrevious={handlePrevious}
              onNext={handleSkip}
            />
          </>
        ) : isQueueExhausted && exhaustedTrack ? (
          /* Queue exhausted — show last played track dimmed with prompt */
          <div className="relative opacity-100 fade-in">
            <NowPlaying
              current={toNowPlayingTrack(exhaustedTrack)}
              previous={exhaustedPrev ? toNowPlayingTrack(exhaustedPrev) : undefined}
              deeperPrevious={exhaustedDeeperPrev.map(toNowPlayingTrack)}
              onPrevious={handlePrevious}
              onNext={() => {}}
            />
            {/* Energetic CTA to keep the party going */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="pointer-events-auto text-center flex flex-col items-center gap-6 fade-in-up bg-void/80 backdrop-blur-md px-12 py-10 rounded-2xl border border-white/[0.04]">
                {tracks.length > 1 && (
                  <p
                    className="text-[12px] font-light tracking-widest uppercase"
                    style={{ color: "#4a4640" }}
                  >
                    {tracks.length} songs played
                  </p>
                )}
                <p
                  className="text-[13px] font-light tracking-widest uppercase"
                  style={{ color: "#7a756d" }}
                >
                  Keep the party going
                </p>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="px-8 py-3 rounded-full border text-[15px] font-medium tracking-wide hover:scale-[1.05] transition-all duration-300"
                  style={{
                    backgroundColor: "rgba(212, 165, 116, 0.15)",
                    borderColor: "rgba(212, 165, 116, 0.3)",
                    color: "#d4a574",
                    animation: "ctaPulseAmber 2.5s ease-in-out infinite",
                  }}
                >
                  Add another song
                </button>
                <p
                  className="text-[11px] font-light tracking-wide"
                  style={{ color: "#7a756f" }}
                >
                  The room is listening
                </p>
              </div>
            </div>
          </div>
        ) : !initialLoaded ? (
          /* Still loading — show nothing to prevent flash */
          null
        ) : (
          /* True empty — no songs ever added */
          <div className="fixed inset-0 z-0">
            {/* Cinematic album wall carousel */}
            <AlbumCarousel />

            {/* Centered CTA floating above the carousel */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="pointer-events-auto relative">
                <div className="relative rounded-2xl flex items-center justify-center px-12 py-10">
                  {!spotifySettled ? (
                    /* Still checking Spotify status — show nothing to prevent flash */
                    null
                  ) : participantId && partyId && !isSpotifyConnected ? (
                    <div className="text-center flex flex-col items-center gap-6">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(29, 185, 84, 0.25)" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#1ed760">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-[15px] font-light tracking-wide" style={{ color: "#c8c4bc" }}>
                          The room is waiting
                        </p>
                        <a
                          href={getSpotifyLoginUrl(participantId, partyId)}
                          className="inline-block px-7 py-3 rounded-full border text-[14px] font-medium tracking-wide hover:scale-[1.05] transition-all duration-300"
                          style={{
                            backgroundColor: "rgba(30, 215, 96, 0.18)",
                            borderColor: "rgba(30, 215, 96, 0.35)",
                            color: "#1ed760",
                            animation: "ctaPulse 2.5s ease-in-out infinite",
                          }}
                        >
                          Connect Spotify
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center flex flex-col items-center gap-6">
                      <p className="text-[13px] font-light tracking-widest uppercase" style={{ color: "#7a756d" }}>
                        Get the party started
                      </p>
                      <button
                        onClick={() => setSearchOpen(true)}
                        className="px-8 py-3 rounded-full border text-[15px] font-medium tracking-wide hover:scale-[1.05] transition-all duration-300"
                        style={{
                          backgroundColor: "rgba(212, 165, 116, 0.15)",
                          borderColor: "rgba(212, 165, 116, 0.3)",
                          color: "#d4a574",
                          animation: "ctaPulseAmber 2.5s ease-in-out infinite",
                        }}
                      >
                        Add the first song
                      </button>
                      <p className="text-[11px] font-light tracking-wide" style={{ color: "#4a4640" }}>
                        Everyone in the room will hear it instantly
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Queue drawer */}
      <QueueDrawer
        isOpen={queueOpen}
        onClose={() => setQueueOpen(false)}
        tracks={queueTracks}
        onAddSong={() => {
          setQueueOpen(false);
          setSearchOpen(true);
        }}
        onReorder={(trackIds) => {
          if (partyId) {
            socket.emit("queue:reorder", { partyId, trackIds });
          }
        }}
        onRemove={(trackId) => {
          if (partyId) {
            socket.emit("queue:remove", { partyId, trackId });
          }
        }}
        onVote={(trackId, value) => {
          if (partyId && participantId) {
            socket.emit("vote:cast", { partyId, trackId, participantId, value });
          }
        }}
        canVote={userVotesUsed < maxVotesPerUser}
      />

      {/* People drawer */}
      <PeopleDrawer
        isOpen={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        participants={participants.map((p) => ({
          id: p.id,
          name: p.displayName,
          color: p.color,
          isHost: p.isHost,
          submissions: tracks.filter((t) => t.addedBy === p.displayName).length,
          votesUsed: new Set(
            tracks
              .filter((t) => t.votes.some((v) => v.participantId === p.id && v.value === 1))
              .map((t) => t.spotifyUri)
          ).size,
          maxVotes: maxVotesPerUser,
        }))}
      />

      {/* Search modal */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAddTrack={handleAddTrack}
      />

      {/* Party over screen */}
      {partyStatus === "ended" && endedData && (
        <PartyOver winner={endedData.winner} rankings={endedData.rankings} />
      )}
    </div>
  );
}
