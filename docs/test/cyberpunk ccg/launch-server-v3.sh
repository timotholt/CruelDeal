#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Open v3 in Chrome
open -a "Google Chrome" "http://localhost:3002/Nightrun%20CCG%20v3.html"

# Start the server (only if not already running)
if ! lsof -i :3002 >/dev/null 2>&1; then
  node server.js
else
  echo "Server already running on port 3002"
fi
