Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root 'store-assets'
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
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

function Draw-Round($G, $Pen, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
  $Path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundPath $Path $X $Y $W $H $R
  $G.DrawPath($Pen, $Path)
  $Path.Dispose()
}

function Write-Text($G, [string]$Text, $Font, $Brush, [float]$X, [float]$Y, [float]$W, [float]$H) {
  $Format = New-Object System.Drawing.StringFormat
  $Format.Alignment = [System.Drawing.StringAlignment]::Near
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $Format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $G.DrawString($Text, $Font, $Brush, (New-Object System.Drawing.RectangleF $X, $Y, $W, $H), $Format)
  $Format.Dispose()
}

function New-Canvas([int]$W, [int]$H) {
  $Bitmap = New-Object System.Drawing.Bitmap $W, $H
  $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $Rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
  $Bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $Rect, ([System.Drawing.Color]::FromArgb(232, 255, 252)), ([System.Drawing.Color]::FromArgb(218, 235, 255)), 28
  $Graphics.FillRectangle($Bg, $Rect)
  $Bg.Dispose()
  return @($Bitmap, $Graphics)
}

function Draw-Logo($G, [float]$X, [float]$Y, [float]$S) {
  $Rect = New-Object System.Drawing.Rectangle ([int]$X), ([int]$Y), ([int]$S), ([int]$S)
  $Grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $Rect, ([System.Drawing.Color]::FromArgb(111, 226, 219)), ([System.Drawing.Color]::FromArgb(111, 162, 255)), 45
  $WhiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(250, 255, 255))
  $BlueBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 93, 171))
  Fill-Round $G $Grad $X $Y $S $S ([Math]::Max(8, $S * 0.22))
  Fill-Round $G $WhiteBrush ($X + $S * 0.20) ($Y + $S * 0.23) ($S * 0.60) ($S * 0.43) ($S * 0.09)
  $Tail = @(
    [System.Drawing.PointF]::new([float]($X + $S * 0.44), [float]($Y + $S * 0.66)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.58), [float]($Y + $S * 0.66)),
    [System.Drawing.PointF]::new([float]($X + $S * 0.44), [float]($Y + $S * 0.80))
  )
  $G.FillPolygon($WhiteBrush, $Tail)
  $LogoFont = New-Object System.Drawing.Font 'Segoe UI', ([float]($S * 0.34)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $Format = New-Object System.Drawing.StringFormat
  $Format.Alignment = [System.Drawing.StringAlignment]::Center
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $G.DrawString('L', $LogoFont, $BlueBrush, (New-Object System.Drawing.RectangleF ($X + $S * 0.20), ($Y + $S * 0.23), ($S * 0.60), ($S * 0.43)), $Format)
  $Grad.Dispose(); $WhiteBrush.Dispose(); $BlueBrush.Dispose(); $LogoFont.Dispose(); $Format.Dispose()
}

$Dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 42, 72))
$Muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(69, 91, 120))
$White = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(250, 255, 255))
$Panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 250, 255))
$Blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 93, 171))
$LinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(207, 222, 238)), 2
$Shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 22, 42, 72))
$Title = New-Object System.Drawing.Font 'Segoe UI', 52, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$H1 = New-Object System.Drawing.Font 'Segoe UI', 38, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$H2 = New-Object System.Drawing.Font 'Segoe UI', 27, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$Body = New-Object System.Drawing.Font 'Segoe UI', 22, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$Small = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$Button = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)

# Screenshot 1: translator
$Canvas = New-Canvas 1280 800; $Bmp = $Canvas[0]; $G = $Canvas[1]
Draw-Logo $G 80 70 92
Write-Text $G 'LingoTrans' $Title $Dark 195 78 420 70
Write-Text $G 'Chinese-English AI Translator' $Body $Muted 200 145 500 40
Fill-Round $G $Shadow 78 218 1126 460 28
Fill-Round $G $White 70 210 1126 460 28
Write-Text $G 'Auto detect' $Small $Muted 110 244 220 36
Write-Text $G 'Chinese' $Small $Muted 652 244 220 36
Write-Text $G 'Input' $H2 $Dark 110 292 220 45
Write-Text $G 'Translation' $H2 $Dark 652 292 260 45
Fill-Round $G $Panel 110 350 490 230 18
Fill-Round $G $Panel 652 350 490 230 18
Draw-Round $G $LinePen 110 350 490 230 18
Draw-Round $G $LinePen 652 350 490 230 18
Write-Text $G 'Hello, I need a quick translation for this sentence.' $Body $Dark 140 390 430 120
Write-Text $G 'Translation appears here in Chinese.' $Body $Dark 682 390 430 120
Fill-Round $G $Blue 960 602 180 52 12
Write-Text $G 'Copy result' $Button $White 995 615 140 32
$Arrow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(24, 93, 171)), 5
$Arrow.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$G.DrawLine($Arrow, 610, 460, 642, 460)
$Bmp.Save((Join-Path $OutDir 'screenshot-1-translator-1280x800.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$Arrow.Dispose(); $G.Dispose(); $Bmp.Dispose()

# Screenshot 2: settings
$Canvas = New-Canvas 1280 800; $Bmp = $Canvas[0]; $G = $Canvas[1]
Draw-Logo $G 92 76 88
Write-Text $G 'Configure your own API' $Title $Dark 205 82 700 70
Write-Text $G 'Use any OpenAI-compatible endpoint and choose the model you trust.' $Body $Muted 210 150 760 40
Fill-Round $G $Shadow 190 228 900 450 28
Fill-Round $G $White 180 220 900 450 28
Write-Text $G 'API Key' $Small $Muted 230 262 160 32
Fill-Round $G $Panel 230 300 800 58 12
Write-Text $G '************************' $Body $Muted 255 314 500 34
Write-Text $G 'Base URL' $Small $Muted 230 382 160 32
Fill-Round $G $Panel 230 420 800 58 12
Write-Text $G 'https://ai.yun.dev/v1' $Body $Dark 255 434 500 34
Write-Text $G 'Model' $Small $Muted 230 502 160 32
Fill-Round $G $Panel 230 540 540 58 12
Write-Text $G 'gpt-4o-mini' $Body $Dark 255 554 400 34
Fill-Round $G $Blue 790 540 240 58 12
Write-Text $G 'Fetch models' $Button $White 846 555 180 32
Fill-Round $G $Blue 770 602 260 54 12
Write-Text $G 'Save and test' $Button $White 832 616 170 32
$Bmp.Save((Join-Path $OutDir 'screenshot-2-settings-1280x800.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$G.Dispose(); $Bmp.Dispose()

# Screenshot 3: sidebar
$Canvas = New-Canvas 1280 800; $Bmp = $Canvas[0]; $G = $Canvas[1]
Write-Text $G 'Works in the Edge sidebar' $Title $Dark 92 82 760 70
Write-Text $G 'Keep the translator open while browsing, writing, or reading.' $Body $Muted 96 150 760 42
Fill-Round $G $Shadow 790 78 330 610 28
$DarkPanel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 37, 37))
Fill-Round $G $DarkPanel 780 70 330 610 28
Draw-Logo $G 810 100 42
Write-Text $G 'LingoTrans' $Small $White 862 103 160 30
Fill-Round $G $White 804 158 282 330 16
Write-Text $G 'Input' $Small $Muted 828 184 120 28
Write-Text $G 'Chinese text entered here.' $Body $Dark 828 222 220 95
Write-Text $G 'Translation' $Small $Muted 828 340 140 28
Write-Text $G 'English translation appears here.' $Body $Dark 828 378 225 90
Fill-Round $G $Blue 890 515 160 48 10
Write-Text $G 'Translate' $Button $White 930 526 100 28
Fill-Round $G $White 92 250 590 170 24
Write-Text $G 'Chinese to English' $H1 $Dark 130 285 360 52
Write-Text $G 'Type Chinese text and get a clean English translation instantly.' $Body $Muted 132 350 500 44
Fill-Round $G $White 92 460 590 170 24
Write-Text $G 'English to Chinese' $H1 $Dark 130 495 360 52
Write-Text $G 'Type English text and translate it into Simplified Chinese.' $Body $Muted 132 560 500 44
$Bmp.Save((Join-Path $OutDir 'screenshot-3-sidebar-1280x800.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$DarkPanel.Dispose(); $G.Dispose(); $Bmp.Dispose()

# Large promotional tile
$Canvas = New-Canvas 1400 560; $Bmp = $Canvas[0]; $G = $Canvas[1]
Draw-Logo $G 95 86 112
Write-Text $G 'LingoTrans' $Title $Dark 230 92 500 70
Write-Text $G 'Chinese-English AI Translator' $H1 $Dark 95 235 620 56
Write-Text $G 'Translate text in the popup or Edge sidebar using your own OpenAI-compatible API endpoint and model.' $Body $Muted 100 305 660 80
Fill-Round $G $Blue 100 420 260 58 14
Write-Text $G 'Fast text translation' $Button $White 136 436 230 32
Fill-Round $G $Shadow 825 82 430 350 30
Fill-Round $G $White 815 72 430 350 30
Write-Text $G 'Input' $Small $Muted 850 110 100 28
Fill-Round $G $Panel 850 145 330 82 16
Write-Text $G 'Hello, how are you?' $Body $Dark 875 170 260 36
Write-Text $G 'Translation' $Small $Muted 850 252 140 28
Fill-Round $G $Panel 850 287 330 82 16
Write-Text $G 'Chinese translation appears here.' $Body $Dark 875 312 260 36
$Arrow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(24, 93, 171)), 6
$Arrow.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$G.DrawLine($Arrow, 985, 240, 1065, 240)
$Bmp.Save((Join-Path $OutDir 'large-promo-1400x560.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$Arrow.Dispose(); $G.Dispose(); $Bmp.Dispose()

$Dark.Dispose(); $Muted.Dispose(); $White.Dispose(); $Panel.Dispose(); $Blue.Dispose()
$LinePen.Dispose(); $Shadow.Dispose(); $Title.Dispose(); $H1.Dispose(); $H2.Dispose(); $Body.Dispose(); $Small.Dispose(); $Button.Dispose()

Get-ChildItem $OutDir -Filter '*.png' | Select-Object Name, Length
