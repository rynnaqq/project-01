import type { ScoreEntry } from '../lib/matches';
import { getAvatar } from '../lib/avatars';

type ScoreboardProps = {
  scores: ScoreEntry[];
  currentUserId?: string;
  winnerId?: string | null;
};

const RANK_TINTS = ['bg-arcade-pop', 'bg-arcade-sun', 'bg-arcade-sea', 'bg-arcade-muted'];

/** Ranked live scoreboard. A sun-yellow sticker crowns the winner. */
export default function Scoreboard({ scores, currentUserId, winnerId }: ScoreboardProps) {
  if (scores.length === 0) {
    return <p className="text-sm font-medium text-stone-600">No scores yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {scores.map((entry, index) => {
        const avatar = getAvatar(entry.profile?.avatar);
        const isWinner = winnerId != null && entry.player_id === winnerId;
        const isMe = entry.player_id === currentUserId;
        return (
          <li
            key={entry.player_id}
            className={`slab flex items-center gap-3 px-4 py-2.5 shadow-pop-sm ${
              isWinner ? '-rotate-1 bg-arcade-sun' : ''
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-arcade-ink font-mono text-xs font-bold text-arcade-ink ${
                RANK_TINTS[index % RANK_TINTS.length]
              }`}
            >
              {index + 1}
            </span>
            <span className="text-2xl" aria-hidden>
              {avatar.emoji}
            </span>
            <span className="flex-1 font-semibold">
              {entry.profile?.username ?? 'player'}
              {isMe && <span className="ml-1 text-xs font-medium text-stone-500">(you)</span>}
              {isWinner && (
                <span className="sticker ml-2 bg-arcade-panel px-2 py-0.5 text-[10px] normal-case text-arcade-ink">
                  ★ winner
                </span>
              )}
            </span>
            <span className="font-mono font-bold tabular-nums text-arcade-ink">{entry.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
