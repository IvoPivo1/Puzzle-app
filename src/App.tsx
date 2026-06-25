import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import BackspaceRounded from '@mui/icons-material/BackspaceRounded'
import BarChartRounded from '@mui/icons-material/BarChartRounded'
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded'
import KeyboardReturnRounded from '@mui/icons-material/KeyboardReturnRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import ShareRounded from '@mui/icons-material/ShareRounded'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  DailyResult,
  FeedbackMark,
  GuessRow,
  LeaderboardEntry,
  PlayerStats,
} from './types'
import {
  buildShareText,
  createGuessFeedback,
  getDailyPuzzle,
  loadStoredResult,
  saveStoredResult,
  updateStreak,
} from './utils/dailyPuzzle'
import {
  fetchLeaderboard,
  getPlayerId,
  isLeaderboardConfigured,
  submitLeaderboardScore,
} from './utils/leaderboard'

const MAX_ATTEMPTS = 6
const STATS_KEY = 'daily-code-player-stats'
const HARD_MODE_KEY = 'daily-code-hard-mode'
const COLOR_ASSIST_KEY = 'daily-code-color-assist'
const SCORE_SUBMIT_PREFIX = 'daily-code-score-submitted:'
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

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
          backgroundImage:
            'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 54,
        },
      },
    },
  },
})

function readJson<T>(key: string, fallback: T) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function readBoolean(key: string, fallback = false) {
  return localStorage.getItem(key) === null
    ? fallback
    : localStorage.getItem(key) === 'true'
}

function getEmptyStats(): PlayerStats {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalAttempts: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    lastCompletedPuzzle: null,
  }
}

function getSubmittedScoreKey(puzzleNumber: number) {
  return `${SCORE_SUBMIT_PREFIX}${puzzleNumber}`
}

function updatePlayerStats(
  currentStats: PlayerStats,
  result: DailyResult,
  puzzleNumber: number,
) {
  if (currentStats.lastCompletedPuzzle === puzzleNumber) {
    return currentStats
  }

  const wins = currentStats.wins + (result.solved ? 1 : 0)
  const currentStreak = result.solved ? currentStats.currentStreak + 1 : 0
  const guessDistribution = { ...currentStats.guessDistribution }

  if (result.solved) {
    guessDistribution[result.attempts] = (guessDistribution[result.attempts] ?? 0) + 1
  }

  return {
    played: currentStats.played + 1,
    wins,
    currentStreak,
    bestStreak: Math.max(currentStats.bestStreak, currentStreak),
    totalAttempts: currentStats.totalAttempts + result.attempts,
    guessDistribution,
    lastCompletedPuzzle: puzzleNumber,
  }
}

function getCountdownToTomorrow() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  const totalSeconds = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function getDailyTheme(puzzleNumber: number) {
  const themes = [
    ['#27f5c7', '#ffbf47', '#15213b'],
    ['#60a5fa', '#f472b6', '#111827'],
    ['#a3e635', '#38bdf8', '#0f172a'],
    ['#f97316', '#22d3ee', '#111827'],
  ]

  return themes[puzzleNumber % themes.length]
}

function validateHardModeGuess(guess: string, previousGuesses: GuessRow[]) {
  for (const previousGuess of previousGuesses) {
    const requiredDigits: Record<string, number> = {}

    for (let index = 0; index < previousGuess.feedback.length; index += 1) {
      const mark = previousGuess.feedback[index]
      const digit = previousGuess.value[index]

      if (mark === 'correct' && guess[index] !== digit) {
        return `Hard mode: digit ${digit} must stay in position ${index + 1}.`
      }

      if (mark === 'correct' || mark === 'misplaced') {
        requiredDigits[digit] = (requiredDigits[digit] ?? 0) + 1
      }
    }

    for (const [digit, count] of Object.entries(requiredDigits)) {
      const usedCount = guess.split('').filter((item) => item === digit).length

      if (usedCount < count) {
        return `Hard mode: your guess must include ${digit}.`
      }
    }
  }

  return ''
}

function AnimatedBackground({
  puzzleNumber,
  themeColors,
}: {
  puzzleNumber: number
  themeColors: string[]
}) {
  return (
    <div className="motion-bg" aria-hidden="true">
      <motion.div
        className="aurora aurora-one"
        style={{ background: themeColors[0] }}
        animate={{ x: [0, 34, -12, 0], y: [0, -28, 18, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="aurora aurora-two"
        style={{ background: themeColors[1] }}
        animate={{ x: [0, -24, 18, 0], y: [0, 24, -12, 0], scale: [1, 0.94, 1.16, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="code-rain">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index}>
            {puzzleNumber} 0101 7392 4458 2081
          </span>
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

function markSymbol(mark: FeedbackMark) {
  if (mark === 'correct') return '✓'
  if (mark === 'misplaced') return '?'
  return '×'
}

function GuessFeedback({
  feedback,
  colorAssist,
}: {
  feedback: FeedbackMark[]
  colorAssist: boolean
}) {
  return (
    <Stack direction="row" spacing={0.75} aria-label="Guess feedback">
      {feedback.map((mark, index) => (
        <motion.span
          aria-label={markLabel(mark)}
          className={`mark ${mark} ${colorAssist ? 'with-symbol' : ''}`}
          initial={{ rotateX: -90, scale: 0.8 }}
          animate={{ rotateX: 0, scale: 1 }}
          transition={{ delay: index * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
          key={`${mark}-${index}`}
        >
          {colorAssist ? markSymbol(mark) : ''}
        </motion.span>
      ))}
    </Stack>
  )
}

function GuessHistory({
  guesses,
  colorAssist,
}: {
  guesses: GuessRow[]
  colorAssist: boolean
}) {
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
              {guesses.map((item) => (
                <motion.article
                  className="guess-row"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  key={item.value}
                >
                  <Typography className="guess-code">{item.value}</Typography>
                  <GuessFeedback feedback={item.feedback} colorAssist={colorAssist} />
                </motion.article>
              ))}
            </AnimatePresence>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function NumberKeypad({
  disabled,
  onDelete,
  onDigit,
  onEnter,
}: {
  disabled: boolean
  onDelete: () => void
  onDigit: (digit: string) => void
  onEnter: () => void
}) {
  return (
    <div className="keypad" aria-label="Number keypad">
      {DIGITS.map((digit) => (
        <Button
          className="keypad-button"
          disabled={disabled}
          key={digit}
          onClick={() => onDigit(digit)}
          type="button"
          variant="outlined"
        >
          {digit}
        </Button>
      ))}
      <Button
        className="keypad-button"
        disabled={disabled}
        onClick={onDelete}
        type="button"
        variant="outlined"
        aria-label="Delete last digit"
      >
        <BackspaceRounded fontSize="small" />
      </Button>
      <Button
        className="keypad-enter"
        disabled={disabled}
        onClick={onEnter}
        startIcon={<KeyboardReturnRounded />}
        type="button"
        variant="contained"
      >
        Enter
      </Button>
    </div>
  )
}

function StatsDialog({
  onClose,
  open,
  stats,
}: {
  onClose: () => void
  open: boolean
  stats: PlayerStats
}) {
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
  const averageAttempts = stats.played
    ? (stats.totalAttempts / stats.played).toFixed(1)
    : '0.0'

  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>Player stats</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <div className="stats-grid">
            <div>
              <strong>{stats.played}</strong>
              <span>Played</span>
            </div>
            <div>
              <strong>{winRate}%</strong>
              <span>Win rate</span>
            </div>
            <div>
              <strong>{stats.currentStreak}</strong>
              <span>Current</span>
            </div>
            <div>
              <strong>{stats.bestStreak}</strong>
              <span>Best</span>
            </div>
          </div>
          <Typography color="text.secondary">
            Average attempts: {averageAttempts}
          </Typography>
          <Divider />
          <Stack spacing={1}>
            {[1, 2, 3, 4, 5, 6].map((attempt) => {
              const value = stats.guessDistribution[attempt] ?? 0
              const maxValue = Math.max(1, ...Object.values(stats.guessDistribution))

              return (
                <div className="distribution-row" key={attempt}>
                  <span>{attempt}</span>
                  <LinearProgress
                    variant="determinate"
                    value={(value / maxValue) * 100}
                  />
                  <span>{value}</span>
                </div>
              )
            })}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

function AboutDialog({ onClose, open }: { onClose: () => void; open: boolean }) {
  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>How to play</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography color="text.secondary">
            Guess the hidden 4-digit code in six attempts. Every player gets the
            same daily puzzle.
          </Typography>
          <Typography color="text.secondary">
            Green means the digit is correct and in the correct position. Yellow
            means the digit exists but is in the wrong position. Dark means the
            digit is not in the code.
          </Typography>
          <Typography color="text.secondary">
            Hard mode forces you to keep using information you already revealed.
            The leaderboard ranks solved games by the fewest attempts.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

function ResultScreen({
  hasSubmittedScore,
  leaderboardStatus,
  onNameChange,
  onShare,
  onSubmitScore,
  playerName,
  puzzleNumber,
  result,
  shareStatus,
}: {
  hasSubmittedScore: boolean
  leaderboardStatus: string
  onNameChange: (name: string) => void
  onShare: () => void
  onSubmitScore: (event: FormEvent<HTMLFormElement>) => void
  playerName: string
  puzzleNumber: number
  result: DailyResult
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
        {result.solved && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        )}
        <CardContent>
          <Chip label={`Daily Code Puzzle #${puzzleNumber}`} color="primary" />
          <Typography component="h2" variant="h2" sx={{ fontSize: '2rem', mt: 2 }}>
            {result.solved ? 'Code cracked' : 'Out of attempts'}
          </Typography>
          <Typography color="text.secondary">{solvedText}</Typography>
          <Box className="result-code" aria-label="Today's code">
            {result.code}
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={onShare}
            startIcon={<ShareRounded />}
          >
            Share result
          </Button>
          <Box component="form" className="name-form" onSubmit={onSubmitScore}>
            <TextField
              disabled={hasSubmittedScore}
              fullWidth
              label="Name for leaderboard"
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Your name"
              slotProps={{ htmlInput: { maxLength: 24 } }}
              value={playerName}
            />
            <Button
              disabled={hasSubmittedScore}
              fullWidth
              variant="outlined"
              color="primary"
              type="submit"
              startIcon={<SendRounded />}
            >
              {hasSubmittedScore ? 'Score submitted' : 'Add to leaderboard'}
            </Button>
          </Box>
          {leaderboardStatus && (
            <Alert
              severity={leaderboardStatus.includes('saved') ? 'success' : 'info'}
              sx={{ mt: 2 }}
            >
              {leaderboardStatus}
            </Alert>
          )}
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

function Leaderboard({
  entries,
  isLoading,
  playerId,
}: {
  entries: LeaderboardEntry[]
  isLoading: boolean
  playerId: string
}) {
  return (
    <Card component="section">
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography component="h2" variant="h2" sx={{ fontSize: '1.25rem' }}>
            Today's leaderboard
          </Typography>
          <Chip label={isLeaderboardConfigured ? 'Live' : 'Setup needed'} color="primary" size="small" />
        </Stack>

        {!isLeaderboardConfigured ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Add your Supabase keys in `.env.local` and Vercel to enable online scores.
          </Alert>
        ) : isLoading ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Loading scores...
          </Typography>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No scores yet today. First name on the board gets bragging rights.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {entries.map((entry, index) => (
              <article
                className={`leader-row ${entry.player_id === playerId ? 'is-player' : ''}`}
                key={entry.id}
              >
                <span className={`leader-rank rank-${index + 1}`}>#{index + 1}</span>
                <span className="leader-name">{entry.player_name}</span>
                <span className={entry.solved ? 'leader-score solved' : 'leader-score'}>
                  {entry.solved ? `${entry.attempts}/6` : 'X/6'}
                </span>
              </article>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function App() {
  const puzzle = useMemo(() => getDailyPuzzle(), [])
  const playerId = useMemo(() => getPlayerId(), [])
  const themeColors = useMemo(() => getDailyTheme(puzzle.puzzleNumber), [puzzle.puzzleNumber])
  const [storedResult, setStoredResult] = useState<DailyResult | null>(() =>
    loadStoredResult(puzzle.dateKey),
  )
  const [guesses, setGuesses] = useState<GuessRow[]>(
    () => storedResult?.guesses ?? [],
  )
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')
  const [invalidPulse, setInvalidPulse] = useState(0)
  const [shareStatus, setShareStatus] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(
    isLeaderboardConfigured,
  )
  const [hasSubmittedScore, setHasSubmittedScore] = useState(
    () => localStorage.getItem(getSubmittedScoreKey(puzzle.puzzleNumber)) === 'true',
  )
  const [stats, setStats] = useState<PlayerStats>(() =>
    readJson(STATS_KEY, getEmptyStats()),
  )
  const [hardMode, setHardMode] = useState(() => readBoolean(HARD_MODE_KEY))
  const [colorAssist, setColorAssist] = useState(() => readBoolean(COLOR_ASSIST_KEY))
  const [countdown, setCountdown] = useState(getCountdownToTomorrow)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const isFinished = Boolean(storedResult)
  const attemptsLeft = MAX_ATTEMPTS - guesses.length
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getCountdownToTomorrow())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isLeaderboardConfigured) {
      return
    }

    fetchLeaderboard(puzzle.puzzleNumber)
      .then(setLeaderboard)
      .catch((error: Error) => setLeaderboardStatus(error.message))
      .finally(() => setIsLoadingLeaderboard(false))
  }, [puzzle.puzzleNumber])

  function showInvalidGuess(message: string) {
    setError(message)
    setInvalidPulse((current) => current + 1)
  }

  function finishGame(nextGuesses: GuessRow[], solved: boolean) {
    const result: DailyResult = {
      dateKey: puzzle.dateKey,
      code: puzzle.code,
      solved,
      attempts: nextGuesses.length,
      guesses: nextGuesses,
      streak: updateStreak(puzzle.dateKey, solved),
    }

    saveStoredResult(result)
    setStoredResult(result)
    setStats((currentStats) => {
      const nextStats = updatePlayerStats(currentStats, result, puzzle.puzzleNumber)
      localStorage.setItem(STATS_KEY, JSON.stringify(nextStats))
      return nextStats
    })
  }

  function submitCurrentGuess() {
    setError('')
    setShareStatus('')

    if (isFinished) {
      showInvalidGuess('You already finished today. Come back tomorrow.')
      return
    }

    if (!/^\d{4}$/.test(guess)) {
      showInvalidGuess('Enter exactly 4 digits.')
      return
    }

    if (guesses.some((item) => item.value === guess)) {
      showInvalidGuess('You already tried that code.')
      return
    }

    if (hardMode) {
      const hardModeMessage = validateHardModeGuess(guess, guesses)

      if (hardModeMessage) {
        showInvalidGuess(hardModeMessage)
        return
      }
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

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitCurrentGuess()
  }

  function addDigit(digit: string) {
    setError('')
    setGuess((currentGuess) => (currentGuess.length < 4 ? `${currentGuess}${digit}` : currentGuess))
  }

  function deleteDigit() {
    setGuess((currentGuess) => currentGuess.slice(0, -1))
  }

  function updateHardMode(nextValue: boolean) {
    setHardMode(nextValue)
    localStorage.setItem(HARD_MODE_KEY, String(nextValue))
  }

  function updateColorAssist(nextValue: boolean) {
    setColorAssist(nextValue)
    localStorage.setItem(COLOR_ASSIST_KEY, String(nextValue))
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

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLeaderboardStatus('')

    if (!storedResult) {
      return
    }

    if (hasSubmittedScore) {
      setLeaderboardStatus('This browser already submitted a score for this puzzle.')
      return
    }

    if (!playerName.trim()) {
      setLeaderboardStatus('Add a name before submitting your score.')
      return
    }

    try {
      await submitLeaderboardScore(
        playerName,
        puzzle.puzzleNumber,
        storedResult,
        playerId,
      )
      localStorage.setItem(getSubmittedScoreKey(puzzle.puzzleNumber), 'true')
      setHasSubmittedScore(true)
      setLeaderboardStatus('Score saved to the leaderboard.')
      setLeaderboard(await fetchLeaderboard(puzzle.puzzleNumber))
    } catch (error) {
      setLeaderboardStatus(error instanceof Error ? error.message : 'Could not save score.')
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        className="theme-shell"
        sx={{
          '--theme-primary': themeColors[0],
          '--theme-secondary': themeColors[1],
          '--theme-deep': themeColors[2],
        }}
      >
        <AnimatedBackground puzzleNumber={puzzle.puzzleNumber} themeColors={themeColors} />
        <Container className="app" maxWidth="sm" component="main">
          <motion.section
            className="hero-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Chip label="Once per day" color="primary" size="small" />
              <Stack direction="row" spacing={1}>
                <IconButton aria-label="Open stats" onClick={() => setIsStatsOpen(true)}>
                  <BarChartRounded />
                </IconButton>
                <IconButton aria-label="How to play" onClick={() => setIsAboutOpen(true)}>
                  <HelpOutlineRounded />
                </IconButton>
              </Stack>
            </Stack>
            <Typography
              component="h1"
              variant="h1"
              sx={{ fontSize: { xs: '3.2rem', sm: '5rem' }, lineHeight: 0.92, mt: 2 }}
            >
              Daily Code Puzzle
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: '1.05rem', mt: 2 }}>
              Crack the hidden 4-digit code. New puzzle in {countdown}.
            </Typography>
          </motion.section>

          <Stack direction="row" spacing={1.25} sx={{ my: 1.5 }}>
            {[
              ['Attempts', attemptsLeft],
              ['Win rate', `${winRate}%`],
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
                hasSubmittedScore={hasSubmittedScore}
                leaderboardStatus={leaderboardStatus}
                onNameChange={setPlayerName}
                onShare={shareResult}
                onSubmitScore={submitScore}
                playerName={playerName}
                puzzleNumber={puzzle.puzzleNumber}
                result={storedResult}
                shareStatus={shareStatus}
              />
            ) : (
              <Card>
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Typography component="h2" variant="h2" sx={{ fontSize: '1.45rem' }}>
                      Enter your code
                    </Typography>
                    <Chip label={`Next ${countdown}`} variant="outlined" size="small" />
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                    Green is exact, yellow is the wrong spot, dark is not in the code.
                  </Typography>
                  <Stack className="option-row">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={hardMode}
                          onChange={(event) => updateHardMode(event.target.checked)}
                        />
                      }
                      label="Hard mode"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={colorAssist}
                          onChange={(event) => updateColorAssist(event.target.checked)}
                        />
                      }
                      label="Symbols"
                    />
                  </Stack>
                  <motion.div
                    animate={invalidPulse ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.28 }}
                    key={invalidPulse}
                  >
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
                      <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        startIcon={<SendRounded />}
                      >
                        Guess
                      </Button>
                    </Box>
                  </motion.div>
                  <NumberKeypad
                    disabled={isFinished}
                    onDelete={deleteDigit}
                    onDigit={addDigit}
                    onEnter={submitCurrentGuess}
                  />
                  {error && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {error}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            <GuessHistory guesses={guesses} colorAssist={colorAssist} />
            <Leaderboard
              entries={leaderboard}
              isLoading={isLoadingLeaderboard}
              playerId={playerId}
            />
          </Stack>
        </Container>
        <StatsDialog
          onClose={() => setIsStatsOpen(false)}
          open={isStatsOpen}
          stats={stats}
        />
        <AboutDialog onClose={() => setIsAboutOpen(false)} open={isAboutOpen} />
      </Box>
    </ThemeProvider>
  )
}

export default App
