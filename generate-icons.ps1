# Ensure icons directory exists
New-Item -ItemType Directory -Force -Path "src/icons"

Add-Type -AssemblyName System.Drawing
function Create-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Use anti-aliasing
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Green background circle
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 204, 113))
    $g.FillEllipse($brush, 0, 0, $size, $size)
    
    # White leaf shape inside (centered circle offset)
    $leafBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255))
    $innerSize = [int]($size * 0.4)
    $offset = [int]($size * 0.3)
    $g.FillEllipse($leafBrush, $offset, $offset, $innerSize, $innerSize)
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $g.Dispose()
    $brush.Dispose()
    $leafBrush.Dispose()
    Write-Host "Generated icon at $path"
}

Create-Icon 16 "src/icons/icon16.png"
Create-Icon 48 "src/icons/icon48.png"
Create-Icon 128 "src/icons/icon128.png"
