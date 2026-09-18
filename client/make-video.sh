#!/bin/bash
set -e

SCORE=${1:-8.2}
POTENTIAL=${2:-9.1}
RATING=${3:-"Chadlite"}
OUTPUT=${4:-"out/score-reveal.mp4"}

mkdir -p "$(dirname "$OUTPUT")"

START_TIME=$(date +%s)

npx remotion render src/remotion/index.ts ScoreReveal "$OUTPUT" \
  --props="{\"score\":$SCORE,\"potential\":$POTENTIAL,\"photoUrl\":\"$(pwd)/public/render-input.jpg\",\"rating\":\"$RATING\"}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "Done. Video saved to $OUTPUT"
echo "Render took ${DURATION} seconds"
