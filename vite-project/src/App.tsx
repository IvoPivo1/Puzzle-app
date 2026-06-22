import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { DailyResult, FeedbackMark, GuessRow } from './types'
import {
  buildShareText,
  createGuessFeedback,
  getDailyPuzzle,
  loadStoredResult,
  saveStoredResult,
  updateStreak,
} from './utils/dailyPuzzle'

const MAX_ATTEMPTS = 6

function GuessFeedback({ feedback }: { feedback: FeedbackMark[] }) {
  return (
    <div className="feedback" aria-label="Guess feedback">
      {feedback.map((mark, index) => (
        <span className={`mark ${mark}`} key={`${mark}-${index}`}>
          {mark === 'correct' ? 'C' : mark === 'misplaced' ? 'M' : 'W'}
        </span>
      ))}
    </div>
  )
}

function GuessHistory({ guesses }: { guesses: GuessRow[] }) {
  return (
    <section className="panel history" aria-labelledby="history-title">
      <h2 id="history-title">Guesses</h2>
      {guesses.length === 0 ? (
        <p className="empty">Your feedback will appear here after each guess.</p>
      ) : (
        <div className="rows">
          {guesses.map((guess) => (
            <article className="guess-row" key={guess.value}>
              <span className="guess-code">{guess.value}</span>
              <GuessFeedback feedback={guess.feedback} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ResultScreen({
  puzzleNumber,
  result,
  onShare,
  shareStatus,
}: {
  puzzleNumber: number
  result: DailyResult
  onShare: () => void
  shareStatus: string
}) {
  const solvedText = result.solved
    ? `Solved in ${result.attempts}/${MAX_ATTEMPTS}`
    : `Missed in ${MAX_ATTEMPTS}/${MAX_ATTEMPTS}`

  return (
    <section className={`result ${result.solved ? 'win' : 'lose'}`}>
      <p className="eyebrow">Daily Code Puzzle #{puzzleNumber}</p>
      <h2>{result.solved ? 'Code cracked' : 'Out of attempts'}</h2>
      <p>{solvedText}</p>
      <div className="result-code" aria-label="Today's code">
        {result.code}
      </div>
      <button className="primary" onClick={onShare} type="button">
        Share result
      </button>
      {shareStatus && <p className="notice">{shareStatus}</p>}
    </section>
  )
}

function App() {
  const puzzle = useMemo(() => getDailyPuzzle(), [])
  const [storedResult, setStoredResult] = useState<DailyResult | null>(() =>
    loadStoredResult(puzzle.dateKey),
  )
  const [guesses, setGuesses] = useState<GuessRow[]>(
    () => storedResult?.guesses ?? [],
  )
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')

  const isFinished = Boolean(storedResult)
  const attemptsLeft = MAX_ATTEMPTS - guesses.length

  function finishGame(nextGuesses: GuessRow[], solved: boolean) {
    const result: DailyResult = {
      dateKey: puzzle.dateKey,
      code: puzzle.code,
      solved,
      attempts: nextGuesses.length,
      guesses: nextGuesses,
      streak: updateStreak(puzzle.dateKey, solved),
    }

    // Saving the complete daily result blocks replay and restores the screen later.
    saveStoredResult(result)
    setStoredResult(result)
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setShareStatus('')

    if (isFinished) {
      setError('You already finished today. Come back tomorrow.')
      return
    }

    if (!/^\d{4}$/.test(guess)) {
      setError('Enter exactly 4 digits.')
      return
    }

    if (guesses.some((item) => item.value === guess)) {
      setError('You already tried that code.')
      return
    }

    const feedback = createGuessFeedback(guess, puzzle.code)
    const nextGuesses = [...guesses, { value: guess, feedback }]
    const solved = guess === puzzle.code

    setGuesses(nextGuesses)
    setGuess('')

    if (solved || nextGuesses.length === MAX_ATTEMPTS) {
      finishGame(nextGuesses, solved)
    }
  }

  async function shareResult() {
    if (!storedResult) {
      return
    }

    const text = buildShareText(puzzle.puzzleNumber, storedResult)

    try {
      await navigator.clipboard.writeText(text)
      setShareStatus('Copied to clipboard.')
    } catch {
      setShareStatus(text)
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Once per day</p>
        <h1>Daily Code Puzzle</h1>
        <p>
          Guess the hidden 4-digit code in six tries. Every player gets the
          same puzzle today.
        </p>
      </section>

      <section className="stats" aria-label="Game stats">
        <article>
          <span>{attemptsLeft}</span>
          <p>Attempts left</p>
        </article>
        <article>
          <span>{storedResult?.streak.current ?? 0}</span>
          <p>Win streak</p>
        </article>
        <article>
          <span>#{puzzle.puzzleNumber}</span>
          <p>Today</p>
        </article>
      </section>

      {storedResult ? (
        <ResultScreen
          onShare={shareResult}
          puzzleNumber={puzzle.puzzleNumber}
          result={storedResult}
          shareStatus={shareStatus}
        />
      ) : (
        <section className="panel play">
          <div>
            <h2>Enter your code</h2>
            <p className="hint">
              Green means correct position, yellow means wrong position, black
              means not in the code.
            </p>
          </div>
          <form onSubmit={submitGuess}>
            <input
              aria-label="Four digit guess"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) =>
                setGuess(event.target.value.replace(/\D/g, '').slice(0, 4))
              }
              pattern="\d{4}"
              placeholder="1234"
              type="text"
              value={guess}
            />
            <button className="primary" type="submit">
              Guess
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      <GuessHistory guesses={guesses} />
    </main>
  )
}

export default App
