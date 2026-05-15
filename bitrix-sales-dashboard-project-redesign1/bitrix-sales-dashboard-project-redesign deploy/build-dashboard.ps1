Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
  Write-Host ""
  Write-Host "Не найден npm. Установите Node.js LTS (вместе с npm), затем запустите этот файл снова."
  Write-Host "Скачать: https://nodejs.org/"
  exit 1
}

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "Устанавливаю зависимости проекта..."
  & npm install
}

Write-Host "Собираю production-версию..."
& npm run build
