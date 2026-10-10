$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskCli = Join-Path $taskProject 'node_modules\electron\cli.js'
try {
    $taskNode = (Get-Command node.exe -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath $taskCli)) { throw 'Dependencies missing. Run npm install in the NXE folder.' }
    Start-Process -FilePath $taskNode -ArgumentList @(('"' + $taskCli + '"'), ('"' + $taskProject + '"')) -WorkingDirectory $taskProject -WindowStyle Hidden
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'NXE could not start') | Out-Null
}
