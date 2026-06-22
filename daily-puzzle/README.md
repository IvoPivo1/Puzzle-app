# Daily Code Puzzle

A mobile-first daily puzzle game built with React, TypeScript, MUI, Framer Motion, CSS, HTML, and Vite. Players get one hidden 4-digit code per day and have six attempts to crack it.

## Features

- One shared daily puzzle for all players
- 4-digit code guessing with position-based feedback
- Six attempts per day
- Replay lock using `localStorage`
- Restores today's result after refresh
- Win and lose screens
- Win streak tracking with `localStorage`
- Share button that copies a compact result grid
- Invalid guess and duplicate guess prevention
- Mobile-first MUI layout with large controls
- Animated background and feedback tile motion with Framer Motion
- Supabase-powered daily leaderboard

## How The Daily Puzzle Works

The app creates a date key from the player's current local date, such as `2026-06-22`.

That date key is passed into a small deterministic seeded random generator in `src/utils/dailyPuzzle.ts`. Because the seed is always the same for the same date, every player gets the same 4-digit code on that day. When the date changes, the seed changes, so the generated code changes automatically.

After the player wins or uses all six attempts, the full daily result is saved in `localStorage` under a key that includes the date. If a result already exists for today, the app shows that result and blocks replay.

## Supabase Leaderboard

Create a free Supabase project, then run this SQL in the Supabase SQL editor:

```sql
create table leaderboard (
  id bigint primary key generated always as identity,
  player_name text not null,
  puzzle_date date not null,
  puzzle_number integer not null,
  attempts integer not null check (attempts between 1 and 6),
  solved boolean not null,
  created_at timestamptz default now()
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
  and attempts between 1 and 6
);
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

- Add an on-screen number keypad
- Add hard mode with no repeated digits
- Add a stats modal with total games and win rate
- Add color-blind friendly feedback symbols
- Add a countdown timer until the next puzzle
