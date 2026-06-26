import { createClient } from '@supabase/supabase-js'
import type { DailyResult, LeaderboardEntry } from '../types'

const PLAYER_ID_KEY = 'daily-code-player-id'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

function normalizeSupabaseUrl(url: string | undefined) {
  if (!url) {
    return ''
  }

  return url.startsWith('http') ? url : `https://${url}`
}

const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseUrl)

const supabase = (() => {
  if (!normalizedSupabaseUrl || !supabaseKey) {
    return null
  }

  try {
    return createClient(normalizedSupabaseUrl, supabaseKey as string)
  } catch {
    return null
  }
})()

export const isLeaderboardConfigured = Boolean(supabase)

export function getPlayerId() {
  const existingId = localStorage.getItem(PLAYER_ID_KEY)

  if (existingId) {
    return existingId
  }

  const nextId = crypto.randomUUID()
  localStorage.setItem(PLAYER_ID_KEY, nextId)
  return nextId
}

export async function fetchLeaderboard(puzzleNumber: number) {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('puzzle_number', puzzleNumber)
    .order('solved', { ascending: false })
    .order('attempts', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) {
    throw new Error(error.message)
  }

  return data as LeaderboardEntry[]
}

export async function submitLeaderboardScore(
  playerName: string,
  puzzleNumber: number,
  result: DailyResult,
  playerId: string,
) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.')
  }

  const score = {
    player_name: playerName.trim().slice(0, 24),
    puzzle_date: result.dateKey,
    puzzle_number: puzzleNumber,
    attempts: result.attempts,
    solved: result.solved,
  }
  const { error } = await supabase.from('leaderboard').insert({
    ...score,
    player_id: playerId,
  })

  if (
    error &&
    error.message.toLowerCase().includes("'player_id' column")
  ) {
    const { error: fallbackError } = await supabase
      .from('leaderboard')
      .insert(score)

    if (fallbackError) {
      throw new Error(fallbackError.message)
    }

    return
  }

  if (error) {
    throw new Error(error.message)
  }
}
