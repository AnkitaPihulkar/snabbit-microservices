# run_and_capture.ps1
# Runs the API integration test in a visible PowerShell window and captures a screen screenshot.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Write-Host "Starting API test in a new visible console window..." -ForegroundColor Cyan

# Start the tests in a new window and keep it open
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoExit -ExecutionPolicy Bypass -Command `"cd '$PSScriptRoot'; .\test_apis.ps1`""
$psi.UseShellExecute = $true
$proc = [System.Diagnostics.Process]::Start($psi)

# Wait for tests to finish and render on screen
Start-Sleep -Seconds 5

# Capture screenshot of the entire desktop
Write-Host "Taking screenshot..." -ForegroundColor Yellow
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $screen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$destPath = "C:\Users\Shreyash\Downloads\test_execution_screenshot.png"
$bitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

# Close the test process window
$proc.Kill()

Write-Host "Screenshot saved to $destPath" -ForegroundColor Green
