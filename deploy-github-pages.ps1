# Publishes this folder to GitHub Pages (free public hosting).
#
# One-time preparation (about 2 minutes, in your browser):
#   1. Create a free account at https://github.com if you don't have one.
#   2. Create a new EMPTY public repository, e.g. "pt-study-assistant"
#      (do not add a README, .gitignore or license).
#   3. Copy the repository URL, e.g. https://github.com/YOUR-NAME/pt-study-assistant.git
#
# Then run (from this folder):
#   powershell -ExecutionPolicy Bypass -File deploy-github-pages.ps1 -Repo https://github.com/YOUR-NAME/pt-study-assistant.git
#
# Git will open a browser window to sign in the first time.
# Afterwards, on GitHub open  Settings -> Pages -> Build and deployment
#   Source: "Deploy from a branch", Branch: "main", Folder: "/ (root)" -> Save.
# Within a minute the site is live at  https://YOUR-NAME.github.io/pt-study-assistant/
# Re-run this script any time to publish updates.

param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Message = "Deploy PT Study Assistant"
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is not installed. Download it from https://git-scm.com/download/win and run this script again."
  exit 1
}

if (-not (Test-Path ".git")) {
  git init -b main | Out-Null
}
if (-not (git config user.email)) {
  git config user.email "student@example.com"
  git config user.name "PT Study Assistant"
}

# Keep the repository small: exclude nothing important, but never commit the build output twice.
@"
dist/
"@ | Set-Content ".gitignore" -Encoding ascii

git add -A
git commit -m $Message 2>$null | Out-Null

if (git remote | Select-String -Quiet "^origin$") {
  git remote set-url origin $Repo
} else {
  git remote add origin $Repo
}

git push -u origin main --force
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push failed. Check the repository URL and that you are signed in to GitHub."
  exit 1
}

$m = [regex]::Match($Repo, "github\.com[/:]([^/]+)/([^/.]+)")
if ($m.Success) {
  $user = $m.Groups[1].Value; $name = $m.Groups[2].Value
  Write-Host ""
  Write-Host "Pushed. Now enable Pages once: https://github.com/$user/$name/settings/pages"
  Write-Host "   Source: Deploy from a branch   Branch: main   Folder: / (root)"
  Write-Host "Your public URL will be: https://$user.github.io/$name/"
}
