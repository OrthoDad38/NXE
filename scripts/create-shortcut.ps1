$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskLauncher = Join-Path $PSScriptRoot 'start-kratos.ps1'
$taskCli = Join-Path $taskProject 'node_modules\electron\cli.js'
if (-not (Test-Path -LiteralPath $taskCli)) { throw 'Run npm install before creating the shortcut.' }
$taskDesktop = [Environment]::GetFolderPath('DesktopDirectory')
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut((Join-Path $taskDesktop 'Project Kratos.lnk'))
$taskShortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskShortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $taskLauncher + '"'
$taskShortcut.WorkingDirectory = $taskProject
$taskShortcut.Description = 'Launch Project Kratos'
$taskShortcut.WindowStyle = 7
$taskIcon = Join-Path $taskProject 'node_modules\electron\dist\electron.exe'
if (Test-Path -LiteralPath $taskIcon) { $taskShortcut.IconLocation = $taskIcon + ',0' }
$taskShortcut.Save()
Write-Host "Created Project Kratos shortcut on $taskDesktop"
