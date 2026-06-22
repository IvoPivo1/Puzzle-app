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

## How The Daily Puzzle Works

The app creates a date key from the player's current local date, such as `2026-06-22`.

That date key is passed into a small deterministic seeded random generator in `src/utils/dailyPuzzle.ts`. Because the seed is always the same for the same date, every player gets the same 4-digit code on that day. When the date changes, the seed changes, so the generated code changes automatically.

After the player wins or uses all six attempts, the full daily result is saved in `localStorage` under a key that includes the date. If a result already exists for today, the app shows that result and blocks replay.

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
