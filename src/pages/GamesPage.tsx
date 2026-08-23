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
        <h1 className="text-2xl font-bold">Games</h1>
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
        <p className="rounded-lg border border-white/10 bg-arcade-panel p-6 text-center text-gray-400">
          No games match those filters yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((game) => (
            <article
              key={game.key}
              className="flex flex-col rounded-xl border border-white/10 bg-arcade-panel p-5"
            >
              <div className="text-3xl">{game.emoji}</div>
              <h2 className="mt-3 text-lg font-semibold">{game.title}</h2>
              <p className="mt-1 flex-1 text-sm text-gray-400">{game.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="rounded bg-arcade-accent/20 px-2 py-0.5 text-xs text-arcade-neon">
                  {game.category}
                </span>
                {game.modes.map((m) => (
                  <span key={m} className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(game)}
                  className="flex-1 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => selectGame(game)}
                  className="flex-1 rounded-md bg-arcade-accent px-3 py-2 text-sm font-medium text-white hover:bg-arcade-accent/80"
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
      <span className="text-sm text-gray-400">{label}:</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={`${label} filter`}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`rounded-md px-3 py-1 text-sm transition ${
              value === opt
                ? 'bg-arcade-accent text-white'
                : 'bg-arcade-panel text-gray-300 hover:bg-white/5'
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} preview`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-arcade-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl">{game.emoji}</div>
            <h2 className="mt-2 text-xl font-bold">{game.title}</h2>
            <p className="text-sm text-gray-400">{game.tagline}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-300">How to play</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
          {game.mechanics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSelect(game)}
            className="rounded-md bg-arcade-accent px-4 py-2 text-sm font-medium text-white hover:bg-arcade-accent/80"
          >
            Select this game
          </button>
        </div>
      </div>
    </div>
  );
}
