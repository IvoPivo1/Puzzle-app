export type FeedbackMark = 'correct' | 'misplaced' | 'wrong'

export type GuessRow = {
  value: string
  feedback: FeedbackMark[]
}

export type StreakState = {
  current: number
  best: number
  lastPlayedDate: string
}

export type DailyResult = {
  dateKey: string
  code: string
  solved: boolean
  attempts: number
  guesses: GuessRow[]
  streak: StreakState
}

export type DailyPuzzle = {
  code: string
  dateKey: string
  puzzleNumber: number
}

export type LeaderboardEntry = {
  id: number
  player_name: string
  puzzle_date: string
  puzzle_number: number
  attempts: number
  solved: boolean
  created_at: string
}
