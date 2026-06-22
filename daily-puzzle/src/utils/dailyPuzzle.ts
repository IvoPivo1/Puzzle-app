import type { DailyPuzzle, DailyResult, FeedbackMark, StreakState } from '../types'

const RESULT_PREFIX = 'daily-code-result:'
const STREAK_KEY = 'daily-code-streak'
const START_DATE = new Date('2026-01-01T00:00:00')
const PUZZLE_RESET_VERSION = 2

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function hashSeed(seed: string) {
  let hash = 2166136261

  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed)

  // Mulberry-style deterministic random generator.
  // The same date/version string always creates the same number sequence.
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function daysBetween(from: Date, to: Date) {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())

  return Math.floor((end - start) / 86400000)
}

export function getDailyPuzzle(date = new Date()): DailyPuzzle {
  const dateKey = getDateKey(date)
  const random = createSeededRandom(`${dateKey}:${PUZZLE_RESET_VERSION}`)
  const code = Array.from({ length: 4 }, () => Math.floor(random() * 10)).join('')
  const basePuzzleNumber = Math.max(1, daysBetween(START_DATE, date) + 1)

  return {
    code,
    dateKey,
    puzzleNumber: basePuzzleNumber + (PUZZLE_RESET_VERSION - 1) * 1000,
  }
}

export function createGuessFeedback(
  guess: string,
  code: string,
): FeedbackMark[] {
  const feedback: FeedbackMark[] = Array(4).fill('wrong')
  const remainingCodeDigits: Record<string, number> = {}

  for (let index = 0; index < code.length; index += 1) {
    if (guess[index] === code[index]) {
      feedback[index] = 'correct'
    } else {
      remainingCodeDigits[code[index]] = (remainingCodeDigits[code[index]] ?? 0) + 1
    }
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (feedback[index] === 'correct') {
      continue
    }

    const digit = guess[index]
    if (remainingCodeDigits[digit]) {
      feedback[index] = 'misplaced'
      remainingCodeDigits[digit] -= 1
    }
  }

  return feedback
}

export function loadStoredResult(dateKey: string): DailyResult | null {
  const storageKey = `${RESULT_PREFIX}${dateKey}:v${PUZZLE_RESET_VERSION}`
  const rawResult = localStorage.getItem(storageKey)

  if (!rawResult) {
    return null
  }

  try {
    // localStorage is the daily lock. Versioning this key lets us reset a day.
    return JSON.parse(rawResult) as DailyResult
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}

export function saveStoredResult(result: DailyResult) {
  localStorage.setItem(
    `${RESULT_PREFIX}${result.dateKey}:v${PUZZLE_RESET_VERSION}`,
    JSON.stringify(result),
  )
}

function getPreviousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() - 1)
  return getDateKey(date)
}

export function updateStreak(dateKey: string, solved: boolean): StreakState {
  const fallback: StreakState = {
    current: 0,
    best: 0,
    lastPlayedDate: '',
  }
  const stored = localStorage.getItem(STREAK_KEY)
  let previous = fallback

  try {
    previous = stored ? (JSON.parse(stored) as StreakState) : fallback
  } catch {
    localStorage.removeItem(STREAK_KEY)
  }

  const wasYesterday = previous.lastPlayedDate === getPreviousDateKey(dateKey)
  const current = solved ? (wasYesterday ? previous.current + 1 : 1) : 0
  const next = {
    current,
    best: Math.max(previous.best, current),
    lastPlayedDate: dateKey,
  }

  localStorage.setItem(STREAK_KEY, JSON.stringify(next))
  return next
}

function markToEmoji(mark: FeedbackMark) {
  if (mark === 'correct') {
    return '🟩'
  }

  if (mark === 'misplaced') {
    return '🟨'
  }

  return '⬛'
}

export function buildShareText(puzzleNumber: number, result: DailyResult) {
  const headline = `Daily Code Puzzle #${puzzleNumber}`
  const score = result.solved
    ? `Solved in ${result.attempts}/6`
    : 'Failed in 6/6'
  const board = result.guesses
    .map((guess) => guess.feedback.map(markToEmoji).join(''))
    .join('\n')

  return `${headline}\n${score}\n${board}`
}
