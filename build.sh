#!/bin/sh
# Rebuilds assets/js/ from src/. Needs Node 18+ and `npm install`.
cd "$(dirname "$0")"
rm -rf assets/js
npm run build
