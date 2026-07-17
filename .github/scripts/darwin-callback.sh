#!/usr/bin/env bash
set -euo pipefail

method=${1:?HTTP method is required}
url=${2:?Callback URL is required}
body_file=${3:-}
output_file=${4:-}

: "${CALLBACK_TOKEN:?DARWIN callback secret is required}"
: "${CALLBACK_NONCE:?Execution callback nonce is required}"
: "${CALLBACK_REPOSITORY:?Expected repository is required}"
: "${CALLBACK_MANIFEST_HASH:?Expected manifest hash is required}"
: "${CALLBACK_EXECUTION_ID:?Expected execution ID is required}"

echo "::add-mask::$CALLBACK_NONCE"
timestamp=$(node -e 'process.stdout.write(String(Date.now()))')
path=$(node -e 'process.stdout.write(new URL(process.argv[1]).pathname)' "$url")
if [ -n "$body_file" ]; then
  body_digest=$(openssl dgst -sha256 "$body_file" | awk '{print $NF}')
else
  body_digest=$(printf '' | openssl dgst -sha256 | awk '{print $NF}')
fi
canonical=$(printf '%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s' \
  "$method" \
  "$path" \
  "$timestamp" \
  "$CALLBACK_NONCE" \
  "$CALLBACK_EXECUTION_ID" \
  "$CALLBACK_REPOSITORY" \
  "$CALLBACK_MANIFEST_HASH" \
  "$body_digest")
signature=$(printf '%s' "$canonical" | \
  openssl dgst -sha256 -hmac "$CALLBACK_TOKEN" | awk '{print $NF}')

arguments=(
  --fail-with-body
  --retry 3
  -X "$method"
  -H "X-Darwin-Timestamp: $timestamp"
  -H "X-Darwin-Execution-Nonce: $CALLBACK_NONCE"
  -H "X-Darwin-Repository: $CALLBACK_REPOSITORY"
  -H "X-Darwin-Manifest-Hash: $CALLBACK_MANIFEST_HASH"
  -H "X-Darwin-Signature: $signature"
)
if [ -n "$body_file" ]; then
  arguments+=(
    -H "Content-Type: application/json"
    --data-binary "@$body_file"
  )
fi
if [ -n "$output_file" ]; then
  arguments+=(--output "$output_file")
fi

curl "${arguments[@]}" "$url"
