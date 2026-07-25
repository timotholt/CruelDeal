#!/bin/zsh
set -e

PROJECT_DIR="/Users/timotholt/Projects/CruelDeal"
SERVER_URL="http://127.0.0.1:3010"
CARD_BACK_URL="http://127.0.0.1:3010/tools/asset-foundry/?tool=card-backs"

cd "$PROJECT_DIR"

echo "Cruel Deal Card Back Foundry"
echo

STARTED_SERVER=false
if ! lsof -iTCP:3010 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting the standalone Asset Foundry..."
  npm run asset-foundry &
  DEV_PID=$!
  STARTED_SERVER=true
else
  echo "Asset Foundry is already running on port 3010."
fi

echo "Waiting for the card-back authoring tool..."
for i in {1..60}; do
  if curl -fsS "$SERVER_URL" >/dev/null 2>&1; then
    open "$CARD_BACK_URL"
    echo
    echo "Card Back Foundry opened:"
    echo "$CARD_BACK_URL"
    if [[ "$STARTED_SERVER" == true ]]; then
      echo
      echo "Leave this window open while using the foundry."
      wait "$DEV_PID"
    fi
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for the Asset Foundry server."
if [[ "$STARTED_SERVER" == true ]]; then
  kill "$DEV_PID" >/dev/null 2>&1 || true
fi
exit 1
