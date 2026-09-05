# Builds dist/index.html: the whole app in one self-contained HTML file
# (CSS and JS inlined; only the CDN libraries and fonts stay external).
# Useful for hosting on any static host or pasting into a single-file deploy.
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Get-Content (Join-Path $Root "index.html") -Raw -Encoding UTF8
$css = Get-Content (Join-Path $Root "css\styles.css") -Raw -Encoding UTF8

# Body markup between <body> and the first <script>
$bodyStart = $html.IndexOf("<body>") + 6
$bodyEnd = $html.IndexOf("<!-- Third-party")
$body = $html.Substring($bodyStart, $bodyEnd - $bodyStart).Trim()

$scripts = @("js/config.js", "js/i18n.js", "js/storage.js", "js/parsers.js", "js/sample-lecture.js", "js/ai/mock.js", "js/ai/api.js", "js/ai/index.js", "js/app.js")
$inline = ($scripts | ForEach-Object { "<script>`n" + (Get-Content (Join-Path $Root $_) -Raw -Encoding UTF8) + "`n</script>" }) -join "`n"

$out = @"
<title>PT Study Assistant</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
$css
</style>
$body
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
$inline
"@

$dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null
[IO.File]::WriteAllText((Join-Path $dist "index.html"), $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote dist/index.html ($([math]::Round($out.Length / 1024)) KB)"
