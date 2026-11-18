#!/bin/sh
# Rebuilds assets/app.js from src/. Needs Node 18+ and: npm i react react-dom react-icons esbuild
cd "$(dirname "$0")"
node_modules/.bin/esbuild src/main.jsx --bundle --minify --format=iife --jsx=automatic --target=es2020 --define:process.env.NODE_ENV=\"production\" --outfile=assets/app.js --log-level=warning
