$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Anita.lnk")
$sc.TargetPath = "c:\Coder\Projects\Anita Psy\scripts\launch.bat"
$sc.WorkingDirectory = "c:\Coder\Projects\Anita Psy"
$sc.Description = "Запустить Anita (AI Психолог)"
$sc.Save()
