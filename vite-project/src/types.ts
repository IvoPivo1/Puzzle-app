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
