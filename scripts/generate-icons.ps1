Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$AssetDir = Join-Path $Root 'assets'
$StoreDir = Join-Path $Root 'store-assets'
if (-not (Test-Path -LiteralPath $StoreDir)) {
  New-Item -ItemType Directory -Path $StoreDir | Out-Null
}

function Add-RoundPath($Path, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
  $D = $R * 2
  $Path.AddArc($X, $Y, $D, $D, 180, 90)
  $Path.AddArc($X + $W - $D, $Y, $D, $D, 270, 90)
  $Path.AddArc($X + $W - $D, $Y + $H - $D, $D, $D, 0, 90)
  $Path.AddArc($X, $Y + $H - $D, $D, $D, 90, 90)
  $Path.CloseFigure()
}

function Fill-Round($G, $Brush, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
  $Path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundPath $Path $X $Y $W $H $R
  $G.FillPath($Brush, $Path)
  $Path.Dispose()
}

function Draw-Logo($G, [float]$X, [float]$Y, [float]$S) {
  $Rect = New-Object System.Drawing.Rectangle ([int]$X), ([int]$Y), ([int]$S), ([int]$S)
  $Bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $Rect, ([System.Drawing.Color]::FromArgb(223, 252, 255)), ([System.Drawing.Color]::FromArgb(239, 253, 244)), 45
  $BlueBubble = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(74, 163, 243))
  $WhiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
  $TextBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(47, 148, 218))
  $OutlinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(143, 208, 245)), ([Math]::Max(1.0, $S * 0.025))
  $Shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(32, 46, 133, 171))
  Fill-Round $G $Bg $X $Y $S $S ([Math]::Max(3, $S * 0.18))

  Fill-Round $G $Shadow ($X + $S * 0.10) ($Y + $S * 0.18) ($S * 0.58) ($S * 0.47) ($S * 0.18)
  Fill-Round $G $BlueBubble ($X + $S * 0.08) ($Y + $S * 0.13) ($S * 0.58) ($S * 0.47) ($S * 0.18)
  $Tail = @(
    [System.Drawing.PointF]::new([float]($X + $S * 0.20), [float]($Y + $S * 0.58)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.32), [float]($Y + $S * 0.58)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.19), [float]($Y + $S * 0.73))
  )
  $G.FillPolygon($BlueBubble, $Tail)

  $Format = New-Object System.Drawing.StringFormat
  $Format.Alignment = [System.Drawing.StringAlignment]::Center
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $AFont = New-Object System.Drawing.Font 'Segoe UI', ([float]($S * 0.38)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $G.DrawString('A', $AFont, $WhiteBrush, (New-Object System.Drawing.RectangleF ($X + $S * 0.12), ($Y + $S * 0.11), ($S * 0.43), ($S * 0.40)), $Format)

  $CircleX = $X + $S * 0.42
  $CircleY = $Y + $S * 0.43
  $CircleS = $S * 0.48
  $G.FillEllipse($Shadow, $CircleX + $S * 0.03, $CircleY + $S * 0.04, $CircleS, $CircleS)
  $G.FillEllipse($WhiteBrush, $CircleX, $CircleY, $CircleS, $CircleS)
  $G.DrawEllipse($OutlinePen, $CircleX, $CircleY, $CircleS, $CircleS)
  $Tail2 = @(
    [System.Drawing.PointF]::new([float]($X + $S * 0.73), [float]($Y + $S * 0.86)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.82), [float]($Y + $S * 0.91)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.78), [float]($Y + $S * 0.80))
  )
  $G.FillPolygon($WhiteBrush, $Tail2)
  $G.DrawLines($OutlinePen, $Tail2)
  $ZhFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', ([float]($S * 0.25)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $G.DrawString(([string][char]0x6587), $ZhFont, $TextBlue, (New-Object System.Drawing.RectangleF $CircleX, ($CircleY + $S * 0.06), $CircleS, ($CircleS * 0.72)), $Format)

  $Bg.Dispose(); $BlueBubble.Dispose(); $WhiteBrush.Dispose(); $TextBlue.Dispose(); $OutlinePen.Dispose(); $Shadow.Dispose()
  $Format.Dispose(); $AFont.Dispose(); $ZhFont.Dispose()
}

function New-Icon([int]$Size, [string]$Path) {
  $Bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  Draw-Logo $Graphics 0 0 $Size
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Graphics.Dispose(); $Bitmap.Dispose()
}

foreach ($Size in @(16, 32, 48, 128)) {
  New-Icon $Size (Join-Path $AssetDir "icon-$Size.png")
}

New-Icon 300 (Join-Path $StoreDir 'logo-300.png')

Get-Item (Join-Path $AssetDir 'icon-16.png'), (Join-Path $AssetDir 'icon-32.png'), (Join-Path $AssetDir 'icon-48.png'), (Join-Path $AssetDir 'icon-128.png'), (Join-Path $StoreDir 'logo-300.png') |
  Select-Object FullName, Length
