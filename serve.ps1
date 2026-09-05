# Optional: tiny local web server (Windows PowerShell, no installs needed).
# Right-click -> "Run with PowerShell", or run:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8080/ in your browser. Press Ctrl+C to stop.
param([int]$Port = 8080, [switch]$NoBrowser)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".png"="image/png"; ".svg"="image/svg+xml"; ".md"="text/plain; charset=utf-8" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "PT Study Assistant running at http://localhost:$Port/  (Ctrl+C to stop)"
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path -eq "/") { $path = "/index.html" }
  $file = Join-Path $Root ($path -replace "/", "\")
  try {
    if (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { "application/octet-stream" }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch { $ctx.Response.StatusCode = 500 }
  $ctx.Response.Close()
}
