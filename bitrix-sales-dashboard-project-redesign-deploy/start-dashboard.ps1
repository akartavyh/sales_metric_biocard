Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Host ""
  Write-Host "npm was not found. Install Node.js LTS (with npm) and run this file again."
  Write-Host "Download: https://nodejs.org/"
  exit 1
}

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "Installing project dependencies..."
  & npm install
}

Write-Host "Starting dashboard at http://127.0.0.1:4173"
& npm run dev -- --host 127.0.0.1 --port 4173
