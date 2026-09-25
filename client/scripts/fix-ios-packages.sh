#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Apple Sign-In 7.1.x still declares Capacitor 7 in SwiftPM. The app uses
# Capacitor 8; patch only its Swift requirement, leaving Android untouched.
node --input-type=commonjs <<'NODE'
const fs = require('node:fs');
const file = 'node_modules/@capacitor-community/apple-sign-in/Package.swift';
const oldRequirement = 'from: "7.0.0"';
const newRequirement = 'from: "8.0.0"';
const source = fs.readFileSync(file, 'utf8');
if (source.includes(oldRequirement)) {
  fs.writeFileSync(file, source.replace(oldRequirement, newRequirement));
  console.log('Apple Sign-In Swift package updated for Capacitor 8.');
} else if (source.includes(newRequirement)) {
  console.log('Apple Sign-In Swift package already supports Capacitor 8.');
} else {
  throw new Error('Apple Sign-In Swift requirement changed; review this compatibility patch.');
}
NODE
