import { useState, useEffect, useRef, useCallback } from "react";
import { getSpotifyToken } from "../lib/api";

interface UseSpotifyPlayerReturn {
  player: Spotify.Player | null;
  deviceId: string | null;
  isReady: boolean;
  isPremium: boolean;
  deviceLost: boolean;
  playerState: Spotify.PlaybackState | null;
  playTrack: (spotifyUri: string, positionMs?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  reclaim: () => Promise<void>;
}

export function useSpotifyPlayer(
  participantId: string | null
): UseSpotifyPlayerReturn {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [deviceLost, setDeviceLost] = useState(false);
  const [playerState, setPlayerState] =
    useState<Spotify.PlaybackState | null>(null);
  const tokenRef = useRef<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  // Fetch token helper
  const fetchToken = useCallback(async (): Promise<string | null> => {
    if (!participantId) return null;
    const data = await getSpotifyToken(participantId);
    if (data) {
      tokenRef.current = data.accessToken;
      setIsPremium(data.isPremium);
      return data.accessToken;
    }
    return null;
  }, [participantId]);

  useEffect(() => {
    if (!participantId) return;

    let mounted = true;

    const init = async () => {
      // Check if we have a valid token first
      const token = await fetchToken();
      if (!token || !mounted) return;

      // Load SDK script if not already loaded
      if (!document.getElementById("spotify-sdk")) {
        const script = document.createElement("script");
        script.id = "spotify-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }

      const createPlayer = () => {
        if (!mounted) return;

        const p = new window.Spotify.Player({
          name: "Nero Party",
          getOAuthToken: (cb) => {
            // Always fetch fresh token
            fetchToken().then((t) => {
              if (t) cb(t);
            });
          },
          volume: 0.5,
        });

        p.addListener("ready", ({ device_id }) => {
          if (!mounted) return;
          console.log("Spotify player ready, device:", device_id);
          setDeviceId(device_id);
          deviceIdRef.current = device_id;
          setIsReady(true);
          setDeviceLost(false);
        });

        p.addListener("not_ready", ({ device_id }) => {
          console.log("Spotify player not ready:", device_id);
          if (mounted) {
            setIsReady(false);
            setDeviceLost(true);
          }
        });

        p.addListener("player_state_changed", (state) => {
          if (mounted) setPlayerState(state);
        });

        p.addListener("initialization_error", ({ message }) => {
          console.error("Spotify init error:", message);
        });

        p.addListener("authentication_error", ({ message }) => {
          console.error("Spotify auth error:", message);
        });

        p.addListener("account_error", ({ message }) => {
          console.error("Spotify account error:", message);
        });

        p.connect();
        setPlayer(p);
        playerRef.current = p;
      };

      // If SDK is already loaded
      if (window.Spotify) {
        createPlayer();
      } else {
        window.onSpotifyWebPlaybackSDKReady = createPlayer;
      }
    };

    init();

    return () => {
      mounted = false;
      playerRef.current?.disconnect();
    };
  }, [participantId, fetchToken]);

  const playTrack = useCallback(
    async (spotifyUri: string, positionMs = 0) => {
      if (!deviceId || !tokenRef.current) return;

      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({
            uris: [spotifyUri],
            position_ms: positionMs,
          }),
        }
      );
    },
    [deviceId]
  );

  const pause = useCallback(async () => {
    await player?.pause();
  }, [player]);

  const resume = useCallback(async () => {
    await player?.resume();
  }, [player]);

  const seek = useCallback(async (positionMs: number) => {
    await player?.seek(positionMs);
  }, [player]);

  const reclaim = useCallback(async () => {
    if (!playerRef.current || !deviceIdRef.current || !tokenRef.current) return;
    // Re-activate the player element and transfer playback back
    await (playerRef.current as any).activateElement();
    await fetch(
      "https://api.spotify.com/v1/me/player",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          device_ids: [deviceIdRef.current],
          play: false,
        }),
      }
    );
    setDeviceLost(false);
  }, []);

  return {
    player,
    deviceId,
    isReady,
    isPremium,
    deviceLost,
    playerState,
    playTrack,
    pause,
    resume,
    seek,
    reclaim,
  };
}
