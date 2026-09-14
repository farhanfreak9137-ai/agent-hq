$wsh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Agent HQ.lnk"
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\agent-hq\Agent-HQ.bat"
$shortcut.WorkingDirectory = "c:\agent-hq"
$shortcut.Description = "Agent HQ - Multi-Agent Office Launcher"
$shortcut.Save()
Write-Output "Shortcut created at: $shortcutPath"
