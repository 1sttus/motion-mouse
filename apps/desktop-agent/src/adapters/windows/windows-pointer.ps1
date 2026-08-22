Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MotionMousePointer {
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  public struct POINT { public int X; public int Y; }
}
'@

while (($line = [Console]::In.ReadLine()) -ne $null) {
  $parts = $line.Split(',')
  if ($parts.Length -ne 2) { continue }
  $dx = 0.0; $dy = 0.0
  if (-not [double]::TryParse($parts[0], [ref]$dx) -or -not [double]::TryParse($parts[1], [ref]$dy)) { continue }
  $point = New-Object MotionMousePointer+POINT
  if ([MotionMousePointer]::GetCursorPos([ref]$point)) {
    [void][MotionMousePointer]::SetCursorPos($point.X + [int][Math]::Round($dx), $point.Y + [int][Math]::Round($dy))
  }
}
