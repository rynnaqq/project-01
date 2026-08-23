import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioProvider';
import { filterGames, type GameFilter } from '../lib/gameFilters';
import {
  ALL_CATEGORIES,
  ALL_MODES,
  GAMES,
  type GameCategory,
  type GameDefinition,
  type GameMode,
} from '../lib/games';
import {
  EyeIcon,
  GameIcon,
  XIcon,
  ZapIcon,
} from '../components/icons';
import { gameTileGradient } from '../lib/gameArt';

/** Tag colour per category so cards scan quickly. */
const CATEGORY_STYLES: Record<GameCategory, string> = {
  Puzzle: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-300',
  Speed: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
  Trivia: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
};

/** Game selection hub (P3.3): filterable catalog with mechanics previews. */
export default function GamesPage() {
  const navigate = useNavigate();
  const { playSfx } = useAudio();
  const [filter, setFilter] = useState<GameFilter>({ mode: 'All', category: 'All' });
  const [preview, setPreview] = useState<GameDefinition | null>(null);

  const visible = useMemo(() => filterGames(GAMES, filter), [filter]);

  function selectGame(game: GameDefinition) {
    playSfx('click');
    navigate(`/lobby?game=${game.key}`);
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide">Games</h1>
        <p className="mt-1 text-gray-400">Pick a game, then create or join a room to play.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterGroup
          label="Mode"
          options={['All', ...ALL_MODES]}
          value={filter.mode}
          onChange={(v) => setFilter((f) => ({ ...f, mode: v as GameMode | 'All' }))}
        />
        <FilterGroup
          label="Category"
          options={['All', ...ALL_CATEGORIES]}
          value={filter.category}
          onChange={(v) => setFilter((f) => ({ ...f, category: v as GameCategory | 'All' }))}
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-arcade-panel/40 p-10 text-center text-gray-400">
          No games match those filters yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((game) => (
            <article
              key={game.key}
              className="group flex flex-col rounded-2xl border border-white/10 bg-arcade-panel p-5 transition-all duration-200 hover:-translate-y-1 hover:border-arcade-line/70 hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gameTileGradient(
                    game.key,
                  )} text-white shadow-glow-sm`}
                >
                  <GameIcon gameKey={game.key} size={24} />
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[game.category]}`}
                >
                  {game.category}
                </span>
              </div>
              <h2 className="mt-4 font-display text-lg tracking-wide">{game.title}</h2>
              <p className="mt-1 flex-1 text-sm text-gray-400">{game.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {game.modes.map((m) => (
                  <span
                    key={m}
                    className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-300"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(game)}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium transition-colors hover:border-white/25 hover:bg-white/5"
                >
                  <EyeIcon size={15} />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => selectGame(game)}
                  className="flex-1 cursor-pointer rounded-lg bg-arcade-accent px-3 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:brightness-95"
                >
                  Select
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal game={preview} onClose={() => setPreview(null)} onSelect={selectGame} />
      )}
    </section>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={`${label} filter`}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`cursor-pointer rounded-md px-3 py-1 text-sm transition-colors ${
              value === opt
                ? 'bg-arcade-primary text-white shadow-glow-sm'
                : 'bg-arcade-panel text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewModal({
  game,
  onClose,
  onSelect,
}: {
  game: GameDefinition;
  onClose: () => void;
  onSelect: (game: GameDefinition) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on open and support Escape to dismiss, so keyboard
  // users can always leave the dialog.
  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} preview`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-rise rounded-2xl border border-arcade-line/60 bg-arcade-panel p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gameTileGradient(
                game.key,
              )} text-white shadow-glow`}
            >
              <GameIcon gameKey={game.key} size={28} />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-wide">{game.title}</h2>
              <p className="text-sm text-gray-400">{game.tagline}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <XIcon size={18} />
          </button>
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-400">
          How to play
        </h3>
        <ul className="mt-2 space-y-2 text-sm text-gray-300">
          {game.mechanics.map((m) => (
            <li key={m} className="flex items-start gap-2">
              <ZapIcon size={14} className="mt-0.5 shrink-0 text-arcade-neon" />
              {m}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSelect(game)}
            className="cursor-pointer rounded-lg bg-arcade-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Select this game
          </button>
        </div>
      </div>
    </div>
  );
}
