import { createClient } from '@supabase/supabase-js'
import type { DailyResult, LeaderboardEntry } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

export const isLeaderboardConfigured = Boolean(supabaseUrl && supabaseKey)

const supabase = isLeaderboardConfigured
  ? createClient(supabaseUrl as string, supabaseKey as string)
  : null

export async function fetchLeaderboard(dateKey: string) {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('puzzle_date', dateKey)
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
) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.')
  }

  const { error } = await supabase.from('leaderboard').insert({
    player_name: playerName.trim().slice(0, 24),
    puzzle_date: result.dateKey,
    puzzle_number: puzzleNumber,
    attempts: result.attempts,
    solved: result.solved,
  })

  if (error) {
    throw new Error(error.message)
  }
}
