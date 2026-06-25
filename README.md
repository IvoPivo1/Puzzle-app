# Daily Code Puzzle

A mobile-first daily code puzzle built with React, TypeScript, MUI, Framer Motion, Supabase, CSS, HTML, and Vite. Players get one shared hidden 4-digit code per day and have six attempts to crack it.

## Features

- One shared daily puzzle generated from the date
- Six attempts per puzzle
- Replay lock with `localStorage`
- Supabase daily leaderboard
- Browser-generated `player_id` for cleaner score tracking
- One leaderboard submit per browser per puzzle
- On-screen mobile number keypad
- Countdown to the next daily puzzle
- Win/loss result screens
- Shareable result grid
- Local player stats modal with win rate, streaks, and guess distribution
- Hard mode that enforces revealed clues
- Color-assist symbols for feedback tiles
- Animated background, feedback flips, invalid-guess shake, and win confetti
- Daily theme colors based on the puzzle number
- How-to-play dialog
- SEO and social preview meta tags

## How The Daily Puzzle Works

The app creates a date key from the player's local date, such as `2026-06-25`.

That date key, plus the internal puzzle reset version, is passed into a deterministic seeded random generator in `src/utils/dailyPuzzle.ts`. Because the seed is stable, every player gets the same 4-digit code for the same puzzle. When the date changes, the seed changes and a new puzzle appears automatically.

After the player wins or uses all six attempts, the full result is saved in `localStorage`. If a result already exists for the current puzzle, the app restores that result and blocks replay.

## Supabase Leaderboard

Create a free Supabase project, then run this SQL in the Supabase SQL editor:

```sql
create table leaderboard (
  id bigint primary key generated always as identity,
  player_name text not null,
  player_id text not null,
  puzzle_date date not null,
  puzzle_number integer not null,
  attempts integer not null check (attempts between 1 and 6),
  solved boolean not null,
  created_at timestamptz default now(),
  unique (player_id, puzzle_number)
);

alter table leaderboard enable row level security;

create policy "Anyone can read leaderboard"
on leaderboard for select
to anon
using (true);

create policy "Anyone can submit score"
on leaderboard for insert
to anon
with check (
  char_length(player_name) between 1 and 24
  and char_length(player_id) between 16 and 80
  and attempts between 1 and 6
);
```

If you already created the old table, run this migration instead:

```sql
alter table leaderboard
add column if not exists player_id text;

update leaderboard
set player_id = 'legacy-' || id
where player_id is null;

alter table leaderboard
alter column player_id set not null;

create unique index if not exists leaderboard_player_puzzle_unique
on leaderboard (player_id, puzzle_number);
```

Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Add the same variables in Vercel under Project Settings -> Environment Variables.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

To build for production:

```bash
npm run build
```

## Future Improvements

- User accounts for cross-device stats
- Server-side score validation
- Global all-time leaderboard
- More puzzle types and weekly challenges
