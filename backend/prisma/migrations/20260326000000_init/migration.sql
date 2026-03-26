-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "maxSongs" INTEGER NOT NULL DEFAULT 20,
    "maxVotesPerUser" INTEGER NOT NULL DEFAULT 5,
    "timeLimitMin" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentTrackId" TEXT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "positionMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "spotifyToken" TEXT,
    "spotifyRefresh" TEXT,
    "spotifyUserId" TEXT,
    "tokenExpiresAt" DATETIME,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "socketId" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "spotifyUri" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "albumArt" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedByParticipantId" TEXT,
    "position" INTEGER NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "score" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueTrack_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL,
    "trackId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "QueueTrack" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackReaction_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "QueueTrack" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListenLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "listenedMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListenLog_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "QueueTrack" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_partyId_displayName_key" ON "Participant"("partyId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_trackId_participantId_key" ON "Vote"("trackId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ListenLog_trackId_participantId_key" ON "ListenLog"("trackId", "participantId");

