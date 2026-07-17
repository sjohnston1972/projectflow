# ProjectFlow Mutation Instructions

ProjectFlow is a real target repository controlled by Darwin.

- Implement only the mutation IDs and acceptance criteria in the supplied Darwin manifest.
- Keep changes inside the manifest's allowed paths and never touch protected paths.
- Preserve privacy-safe telemetry and stable `data-darwin-id` attributes.
- Do not add a variant flag, mock implementation, precomputed result, or hidden alternate UI.
- Add focused tests for changed behavior.
- Run `npm run verify` before declaring the mutation complete.
- Leave unrelated code and styling unchanged.
