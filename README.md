# ProjectFlow

ProjectFlow is a deliberately imperfect task-management application used as
Darwin's measured software-evolution target.

## Development

```bash
npm ci
npm run dev
```

The application runs at `http://localhost:5174`. Open `/study` to display the
live privacy-safe telemetry stream sent to the Darwin API.

## Verification

```bash
npm run verify
```

ProjectFlow contains no alternate evolved variant. Darwin mutations must arrive
as reviewable Git commits produced against the current repository revision.
