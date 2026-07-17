import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [bundlePath] = process.argv.slice(2);
if (!bundlePath) {
  throw new Error('Usage: node validate-darwin-patch.mjs <bundle.json>');
}

const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
const { execution, manifest } = bundle;
if (!execution || !manifest) throw new Error('Darwin bundle is incomplete.');
if (execution.baseSha !== manifest.repository?.baseSha) {
  throw new Error('Execution and manifest base commits do not match.');
}

const output = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
const changedFiles = output(
  'diff',
  '--name-only',
  '--diff-filter=ACMR',
  execution.baseSha,
  '--',
)
  .split('\n')
  .filter(Boolean);

const globPattern = (glob) => {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^${escaped.replaceAll('**', '___DARWIN_GLOBSTAR___').replaceAll('*', '[^/]*').replaceAll('___DARWIN_GLOBSTAR___', '.*')}$`,
  );
};
const matches = (path, patterns) =>
  patterns.some((pattern) => globPattern(pattern).test(path));

if (!changedFiles.length) throw new Error('Codex produced no repository change.');
const protectedChange = changedFiles.find((path) =>
  matches(path, manifest.protectedPaths),
);
if (protectedChange) {
  throw new Error(`Codex changed protected path: ${protectedChange}`);
}
const disallowedChange = changedFiles.find(
  (path) => !matches(path, manifest.allowedPaths),
);
if (disallowedChange) {
  throw new Error(`Codex changed path outside the manifest: ${disallowedChange}`);
}
if (changedFiles.length > execution.repository.maximumChangedFiles) {
  throw new Error(
    `Codex changed ${changedFiles.length} files; limit is ${execution.repository.maximumChangedFiles}.`,
  );
}

const numstat = output('diff', '--numstat', execution.baseSha, '--');
let changedLines = 0;
for (const line of numstat.split('\n').filter(Boolean)) {
  const [added, removed] = line.split('\t');
  if (added === '-' || removed === '-') {
    throw new Error('Binary changes are not permitted.');
  }
  changedLines += Number(added) + Number(removed);
}
if (changedLines > execution.repository.maximumChangedLines) {
  throw new Error(
    `Codex changed ${changedLines} lines; limit is ${execution.repository.maximumChangedLines}.`,
  );
}

process.stdout.write(
  JSON.stringify({ changedFiles, changedLines, baseSha: execution.baseSha }),
);
