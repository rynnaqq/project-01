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

/** Sticker colour per band so cards scan quickly. */
const CATEGORY_STYLES: Record<GameCategory, string> = {
  Puzzle: 'bg-arcade-sea text-arcade-ink',
  Speed: 'bg-arcade-pop text-arcade-ink',
  Trivia: 'bg-arcade-sun text-arcade-ink',
};

const CARD_TILTS = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2'];

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
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide sm:text-4xl">
          <span className="text-pop-shadow">Games</span>
        </h1>
        <p className="mt-1.5 font-medium text-stone-600">
          Pick a game, then create or join a room to play.
        </p>
      </div>

      <div className="slab flex flex-col gap-4 p-4 shadow-pop sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
        <p className="slab p-10 text-center font-medium text-stone-600 shadow-pop-sm">
          No games match those filters yet.
        </p>
      ) : (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {visible.map((game, i) => (
            <article
              key={game.key}
              className={`slab ${CARD_TILTS[i % CARD_TILTS.length]} group flex flex-col p-5 shadow-pop transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-pop-lg`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-arcade-ink bg-gradient-to-br ${gameTileGradient(
                    game.key,
                  )} text-white shadow-pop-sm`}
                >
                  <GameIcon gameKey={game.key} size={26} />
                </span>
                <span
                  className={`sticker px-2.5 py-1 text-[11px] ${CATEGORY_STYLES[game.category]} ${
                    i % 2 === 0 ? 'rotate-2' : '-rotate-2'
                  }`}
                >
                  {game.category}
                </span>
              </div>
              <h2 className="mt-4 font-display text-sm uppercase leading-snug tracking-wide">
                {game.title}
              </h2>
              <p className="mt-1.5 flex-1 text-sm font-medium text-stone-600">{game.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {game.modes.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border-2 border-arcade-ink bg-arcade-muted px-2.5 py-0.5 text-xs font-bold text-arcade-ink"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreview(game)}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-3 py-2 text-sm font-bold text-arcade-ink transition-all hover:bg-arcade-muted hover:shadow-pop-sm active:translate-y-0 active:shadow-none"
                >
                  <EyeIcon size={15} aria-hidden />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => selectGame(game)}
                  className="flex-1 cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-3 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:shadow-none"
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
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-xs font-bold uppercase tracking-[0.25em] text-stone-500">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} filter`}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-bold transition-all ${
              value === opt
                ? 'border-arcade-ink bg-arcade-pop text-arcade-ink shadow-pop-sm'
                : 'border-transparent bg-arcade-muted text-stone-600 hover:border-arcade-ink hover:text-arcade-ink'
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${game.title} preview`}
      onClick={onClose}
    >
      <div
        className="slab w-full max-w-md rotate-[-1deg] animate-rise p-6 shadow-pop-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-16 w-16 shrink-0 -rotate-3 items-center justify-center rounded-2xl border-[3px] border-arcade-ink bg-gradient-to-br ${gameTileGradient(
                game.key,
              )} text-white shadow-pop`}
            >
              <GameIcon gameKey={game.key} size={30} />
            </span>
            <div>
              <h2 className="font-display text-base uppercase leading-snug tracking-wide">
                {game.title}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-stone-600">{game.tagline}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="cursor-pointer rounded-full border-2 border-arcade-ink bg-arcade-panel p-1.5 text-arcade-ink transition-all hover:bg-arcade-sun hover:shadow-pop-sm"
          >
            <XIcon size={18} />
          </button>
        </div>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-stone-500">
          How to play
        </h3>
        <ul className="mt-2 space-y-2 text-sm font-medium text-stone-700">
          {game.mechanics.map((m) => (
            <li key={m} className="flex items-start gap-2">
              <ZapIcon size={14} className="mt-0.5 shrink-0 text-arcade-neon" aria-hidden />
              {m}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-4 py-2 text-sm font-bold text-arcade-ink transition-colors hover:bg-arcade-muted"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onSelect(game)}
            className="cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:shadow-none"
          >
            Select this game
          </button>
        </div>
      </div>
    </div>
  );
}
