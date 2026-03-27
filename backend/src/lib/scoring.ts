// Shared scoring constants and logic used by both real-time (vote:cast)
// and final (endParty) scoring to keep them consistent.

export const POINTS = {
  VOTE: 300,
  SELF_VOTE: 100,
  COMMENT: 200,
  SELF_COMMENT: 65,
  EMOJI: 100,
  SELF_EMOJI: 35,
  MIN_VOTES_TO_WIN: 2,
} as const;

export interface ScoreInput {
  votes: { participantId: string; value: number }[];
  commentCount: number;
  emojiCount: number;
  selfCommentCount: number;
  selfEmojiCount: number;
  addedByParticipantId: string | null;
  activeParticipantCount: number;
}

export function computeScore(input: ScoreInput): number {
  const {
    votes,
    commentCount,
    emojiCount,
    selfCommentCount,
    selfEmojiCount,
    addedByParticipantId,
    activeParticipantCount,
  } = input;

  const activeVotes = votes.filter((v) => v.value === 1);
  const voteCount = activeVotes.length;

  // Self-vote weighting: own vote worth 1/3 of a normal vote
  let voteScore = 0;
  for (const v of activeVotes) {
    voteScore +=
      v.participantId === addedByParticipantId
        ? POINTS.SELF_VOTE
        : POINTS.VOTE;
  }

  // Normalize: boost songs with higher vote participation rate
  if (activeParticipantCount > 1 && voteCount > 0) {
    const voteRate = voteCount / activeParticipantCount;
    voteScore = voteScore * (1 + voteRate);
  }

  // Reactions: self-reactions are discounted to ~1/3 value
  const otherComments = commentCount - selfCommentCount;
  const otherEmojis = emojiCount - selfEmojiCount;
  const reactionScore =
    otherComments * POINTS.COMMENT +
    selfCommentCount * POINTS.SELF_COMMENT +
    otherEmojis * POINTS.EMOJI +
    selfEmojiCount * POINTS.SELF_EMOJI;

  return Math.round(voteScore + reactionScore);
}
