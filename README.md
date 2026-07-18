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

## Deployment

Production is deployed from `main` to
`https://darwin-projectflow.pages.dev`. Darwin mutation branches are deployed
as isolated Cloudflare Pages previews before a human releases the associated
pull request. GitHub Actions requires the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets.

Every build publishes privacy-safe semantic deployment metadata in the HTML
head: `darwin-commit-sha` identifies the full source commit and
`darwin-app-version` identifies the measured version. Darwin verifies both
values after a reviewed merge before it opens a new evidence cycle.

The baseline reset workflow reports its running, validation, failure, and
deployment states through an execution-scoped signed callback. Darwin keeps
the measured study locked until production reports the restored commit.
