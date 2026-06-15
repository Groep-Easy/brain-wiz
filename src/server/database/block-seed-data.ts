/**
 * @file src/server/database/block-seed-data.ts
 * @description Canonical definitions of the game-flow building blocks. This is
 * the server-side source of truth that used to live in the host's `blocks.ts`.
 * BlockSeederService upserts these rows into the `game_blocks` table on boot.
 */
import { BlockKindEnum, QuestionThemeEnum } from '../entities/enums'

export interface BlockSeed {
  id: string
  kind: BlockKindEnum
  label: string
  icon: string
  theme: QuestionThemeEnum | null
  minigameKey: string | null
}

/** Trivia themes — one block per QuestionThemeEnum value. */
const THEME_BLOCKS: BlockSeed[] = [
  { theme: QuestionThemeEnum.HISTORY, label: 'History', icon: '🏺' },
  { theme: QuestionThemeEnum.SCIENCE, label: 'Science', icon: '🔬' },
  { theme: QuestionThemeEnum.SPORT, label: 'Sport', icon: '⚽' },
  { theme: QuestionThemeEnum.CULTURE, label: 'Culture', icon: '🎭' },
  { theme: QuestionThemeEnum.GEOGRAPHY, label: 'Geography', icon: '🌍' },
  { theme: QuestionThemeEnum.TECHNOLOGY, label: 'Technology', icon: '💻' },
  { theme: QuestionThemeEnum.ART, label: 'Art', icon: '🎨' },
  { theme: QuestionThemeEnum.CODING, label: 'Coding', icon: '💻' },
  { theme: QuestionThemeEnum.FILMS, label: 'Films', icon: '🎬' },
  { theme: QuestionThemeEnum.GAMING, label: 'Gaming', icon: '🎮' },
  { theme: QuestionThemeEnum.GENERAL, label: 'General', icon: '🧠' },
  { theme: QuestionThemeEnum.INTERNET, label: 'Internet', icon: '🌐' },
  { theme: QuestionThemeEnum.MUSIC, label: 'Music', icon: '🎵' },
  { theme: QuestionThemeEnum.OTHER, label: 'Other', icon: '❓' },
].map((t) => ({
  id: `theme-${t.theme}`,
  kind: BlockKindEnum.THEME,
  label: t.label,
  icon: t.icon,
  theme: t.theme,
  minigameKey: null,
}))

/** Implemented mini-game modules. */
const MINIGAME_BLOCKS: BlockSeed[] = [
  { minigameKey: 'balance-scale', label: 'Balance Scale', icon: '⚖️' },
  { minigameKey: 'sliding-puzzle', label: 'Sliding Puzzle', icon: '🧩' },
].map((m) => ({
  id: `mini-${m.minigameKey}`,
  kind: BlockKindEnum.MINIGAME,
  label: m.label,
  icon: m.icon,
  theme: null,
  minigameKey: m.minigameKey,
}))

/** The full palette, in display order. */
export const BLOCK_SEED: BlockSeed[] = [...THEME_BLOCKS, ...MINIGAME_BLOCKS]
