import type { ScoreEntry } from '../lib/matches';
import { getAvatar } from '../lib/avatars';

type ScoreboardProps = {
  scores: ScoreEntry[];
  currentUserId?: string;
  winnerId?: string | null;
};

/** Ranked live scoreboard. Gold marks the winner; glass carries the rest. */
export default function Scoreboard({ scores, currentUserId, winnerId }: ScoreboardProps) {
  if (scores.length === 0) {
    return <p className="text-sm text-slate-400">No scores yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {scores.map((entry, index) => {
        const avatar = getAvatar(entry.profile?.avatar);
        const isWinner = winnerId != null && entry.player_id === winnerId;
        const isMe = entry.player_id === currentUserId;
        return (
          <li
            key={entry.player_id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${
              isWinner
                ? 'border-arcade-gold/40 bg-arcade-gold/10 shadow-underglow-gold'
                : 'glass-chip'
            }`}
          >
            <span className="w-6 text-center font-mono text-slate-400">{index + 1}</span>
            <span className="text-2xl" aria-hidden>
              {avatar.emoji}
            </span>
            <span className="flex-1 font-medium">
              {entry.profile?.username ?? 'player'}
              {isMe && <span className="ml-1 text-xs text-slate-500">(you)</span>}
              {isWinner && (
                <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-arcade-gold">
                  ★ winner
                </span>
              )}
            </span>
            <span className={`font-mono tabular-nums ${isWinner ? 'text-arcade-gold' : 'text-arcade-neon'}`}>
              {entry.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
