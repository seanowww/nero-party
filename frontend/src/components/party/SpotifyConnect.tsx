import { getSpotifyLoginUrl } from "../../lib/api";

interface SpotifyConnectProps {
  participantId: string;
  partyId: string;
  isConnected: boolean;
  isPremium: boolean;
}

export default function SpotifyConnect({
  participantId,
  partyId,
  isConnected,
  isPremium,
}: SpotifyConnectProps) {
  if (isConnected && isPremium) return null;

  const loginUrl = getSpotifyLoginUrl(participantId, partyId);

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 fade-in w-[calc(100%-2rem)] sm:w-auto max-w-md">
      {!isConnected ? (
        <a
          href={loginUrl}
          className="flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/25 text-[#1DB954] text-[11px] sm:text-[12px] font-medium tracking-wide hover:bg-[#1DB954]/25 transition-all duration-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect Spotify to listen
        </a>
      ) : (
        <div className="px-4 sm:px-5 py-2.5 rounded-full bg-amber/10 border border-amber/20 text-amber/70 text-[10px] sm:text-[11px] font-light tracking-wide text-center">
          Spotify Premium required for audio — you can still vote and react
        </div>
      )}
    </div>
  );
}
