import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
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

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#27f5c7',
    },
    secondary: {
      main: '#ffbf47',
    },
    background: {
      default: '#070a13',
      paper: 'rgba(14, 20, 36, 0.78)',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontWeight: 950,
      letterSpacing: 0,
    },
    h2: {
      fontWeight: 900,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 900,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,255,255,0.11)',
          backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 56,
        },
      },
    },
  },
})

function AnimatedBackground() {
  return (
    <div className="motion-bg" aria-hidden="true">
      <motion.div
        className="aurora aurora-one"
        animate={{ x: [0, 34, -12, 0], y: [0, -28, 18, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="aurora aurora-two"
        animate={{ x: [0, -24, 18, 0], y: [0, 24, -12, 0], scale: [1, 0.94, 1.16, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="code-rain">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index}>0101 7392 4458 2081</span>
        ))}
      </div>
    </div>
  )
}

function markLabel(mark: FeedbackMark) {
  if (mark === 'correct') return 'Correct position'
  if (mark === 'misplaced') return 'Wrong position'
  return 'Wrong digit'
}

function GuessFeedback({ feedback }: { feedback: FeedbackMark[] }) {
  return (
    <Stack direction="row" spacing={0.75} aria-label="Guess feedback">
      {feedback.map((mark, index) => (
        <motion.span
          aria-label={markLabel(mark)}
          className={`mark ${mark}`}
          initial={{ rotateX: -90, scale: 0.8 }}
          animate={{ rotateX: 0, scale: 1 }}
          transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
          key={`${mark}-${index}`}
        />
      ))}
    </Stack>
  )
}

function GuessHistory({ guesses }: { guesses: GuessRow[] }) {
  return (
    <Card component="section">
      <CardContent>
        <Typography component="h2" variant="h2" sx={{ fontSize: '1.25rem', mb: 1 }}>
          Guess history
        </Typography>
        {guesses.length === 0 ? (
          <Typography color="text.secondary">
            Make a guess to reveal your feedback tiles.
          </Typography>
        ) : (
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            <AnimatePresence initial={false}>
              {guesses.map((guess) => (
                <motion.article
                  className="guess-row"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  key={guess.value}
                >
                  <Typography className="guess-code">{guess.value}</Typography>
                  <GuessFeedback feedback={guess.feedback} />
                </motion.article>
              ))}
            </AnimatePresence>
          </Stack>
        )}
      </CardContent>
    </Card>
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
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      <Card className={result.solved ? 'result win' : 'result lose'}>
        <CardContent>
          <Chip label={`Daily Code Puzzle #${puzzleNumber}`} color="primary" />
          <Typography component="h2" variant="h2" sx={{ fontSize: '2rem', mt: 2 }}>
            {result.solved ? 'Code cracked' : 'Out of attempts'}
          </Typography>
          <Typography color="text.secondary">{solvedText}</Typography>
          <Box className="result-code" aria-label="Today's code">
            {result.code}
          </Box>
          <Button fullWidth variant="contained" color="secondary" onClick={onShare}>
            Share result
          </Button>
          {shareStatus && (
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left', whiteSpace: 'pre-line' }}>
              {shareStatus}
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AnimatedBackground />
      <Container className="app" maxWidth="sm" component="main">
        <motion.section
          className="hero-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Chip label="Once per day" color="primary" size="small" />
          <Typography
            component="h1"
            variant="h1"
            sx={{ fontSize: { xs: '3.2rem', sm: '5rem' }, lineHeight: 0.92, mt: 2 }}
          >
            Daily Code Puzzle
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: '1.05rem', mt: 2 }}>
            Guess the hidden 4-digit code in six tries. The puzzle updates every
            morning and locks after you finish.
          </Typography>
        </motion.section>

        <Stack direction="row" spacing={1.25} sx={{ my: 1.5 }}>
          {[
            ['Attempts', attemptsLeft],
            ['Streak', storedResult?.streak.current ?? 0],
            ['Puzzle', `#${puzzle.puzzleNumber}`],
          ].map(([label, value]) => (
            <Card className="stat-card" key={label}>
              <CardContent>
                <Typography className="stat-value">{value}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: '0.76rem' }}>
                  {label}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        <Stack spacing={1.5}>
          {storedResult ? (
            <ResultScreen
              onShare={shareResult}
              puzzleNumber={puzzle.puzzleNumber}
              result={storedResult}
              shareStatus={shareStatus}
            />
          ) : (
            <Card>
              <CardContent>
                <Typography component="h2" variant="h2" sx={{ fontSize: '1.45rem' }}>
                  Enter your code
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Green is exact, yellow is the wrong spot, dark is not in the code.
                </Typography>
                <Box component="form" className="guess-form" onSubmit={submitGuess}>
                  <TextField
                    aria-label="Four digit guess"
                    autoComplete="off"
                    fullWidth
                    slotProps={{
                      htmlInput: { inputMode: 'numeric', maxLength: 4, pattern: '\\d{4}' },
                    }}
                    onChange={(event) =>
                      setGuess(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="1234"
                    value={guess}
                  />
                  <Button fullWidth variant="contained" color="primary" type="submit">
                    Guess
                  </Button>
                </Box>
                {error && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <GuessHistory guesses={guesses} />
        </Stack>
      </Container>
    </ThemeProvider>
  )
}

export default App
