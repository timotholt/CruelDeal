#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Open in Chrome
open -a "Google Chrome" "http://localhost:3002"

# Start the server
node server.js
