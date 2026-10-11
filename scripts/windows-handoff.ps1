param([Parameter(Mandatory=$true)][int]$TargetProcessId)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NxeWindow {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int Size; public RECT Monitor,Work; public uint Flags; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
  [DllImport("user32.dll",EntryPoint="GetMonitorInfoW")] public static extern bool GetMonitorInfo(IntPtr h,ref MONITORINFO info);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr h,int index);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  public static bool Fullscreen(IntPtr h) {
    try{SetThreadDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
    if(h==IntPtr.Zero || !IsWindowVisible(h) || (GetWindowLong(h,-16)&0x00C00000)!=0)return false;
    RECT r; var m=new MONITORINFO();m.Size=Marshal.SizeOf(m);
    if(!GetWindowRect(h,out r)||!GetMonitorInfo(MonitorFromWindow(h,2),ref m))return false;
    return Math.Abs(r.Left-m.Monitor.Left)<=2 && Math.Abs(r.Top-m.Monitor.Top)<=2 && Math.Abs(r.Right-m.Monitor.Right)<=2 && Math.Abs(r.Bottom-m.Monitor.Bottom)<=2;
  }
}
'@
$deadline=[DateTime]::UtcNow.AddSeconds(30)
$stableCount=0
while([DateTime]::UtcNow -lt $deadline){
  try{$target=Get-Process -Id $TargetProcessId -ErrorAction Stop;$target.Refresh()}catch{exit 0}
  $handle=$target.MainWindowHandle
  if([NxeWindow]::Fullscreen($handle)){$stableCount++}else{$stableCount=0}
  if($stableCount -ge 3){
    [Console]::Out.WriteLine('fullscreen');[Console]::Out.Flush()
    if([Console]::In.ReadLine() -eq 'release'){
      $target.Refresh();$handle=$target.MainWindowHandle
      if([NxeWindow]::Fullscreen($handle)){[NxeWindow]::BringWindowToTop($handle) | Out-Null;[NxeWindow]::SetForegroundWindow($handle) | Out-Null}
    }
    exit 0
  }
  Start-Sleep -Milliseconds 150
}
exit 0
