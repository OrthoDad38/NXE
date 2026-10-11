param([long]$KioskWindowHandle=0,[int]$TargetProcessId=0,[int]$SettleMs=1800)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NxeWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO {public int Size;public RECT Monitor,Work;public uint Flags;}
 public delegate bool EnumProc(IntPtr h,IntPtr data);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr data);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint process);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out RECT r,int size);
 [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll",EntryPoint="GetMonitorInfoW")] public static extern bool GetMonitorInfo(IntPtr h,ref MONITORINFO m);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int size,uint flags);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 public static IntPtr FindWindow(uint process) {
  IntPtr best=IntPtr.Zero;long area=0;
  EnumWindows(delegate(IntPtr h,IntPtr data){uint owner;GetWindowThreadProcessId(h,out owner);RECT r;
   if(owner==process&&IsWindowVisible(h)&&GetWindowRect(h,out r)){long size=(long)(r.Right-r.Left)*(r.Bottom-r.Top);if(size>area){area=size;best=h;}}return true;},IntPtr.Zero);
  return best;
 }
 public static void Shield(IntPtr kiosk,IntPtr game) {
  if(kiosk!=IntPtr.Zero){SetWindowPos(kiosk,new IntPtr(-1),0,0,0,0,0x213);if(game!=IntPtr.Zero)SetWindowPos(game,new IntPtr(1),0,0,0,0,0x213);}
 }
 public static bool Fullscreen(IntPtr h) {
  try{SetThreadDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
  if(h==IntPtr.Zero||!IsWindowVisible(h)||(GetWindowLong(h,-16)&0x00C00000)!=0)return false;
  RECT r,visible;var m=new MONITORINFO();m.Size=Marshal.SizeOf(m);
  if(!GetWindowRect(h,out r)||!GetMonitorInfo(MonitorFromWindow(h,2),ref m))return false;
  if(DwmGetWindowAttribute(h,9,out visible,Marshal.SizeOf(typeof(RECT)))==0)r=visible;
  return Math.Abs(r.Left-m.Monitor.Left)<=2&&Math.Abs(r.Top-m.Monitor.Top)<=2&&Math.Abs(r.Right-m.Monitor.Right)<=2&&Math.Abs(r.Bottom-m.Monitor.Bottom)<=2;
 }
 public static void Reveal(IntPtr kiosk,IntPtr game){if(kiosk!=IntPtr.Zero)SetWindowPos(kiosk,new IntPtr(-2),0,0,0,0,0x213);SetWindowPos(game,IntPtr.Zero,0,0,0,0,3);SetForegroundWindow(game);}
}
'@
[NxeWindow]::Shield([IntPtr]$KioskWindowHandle,[IntPtr]::Zero)
[Console]::Out.WriteLine('armed');[Console]::Out.Flush()
if($TargetProcessId -eq 0){$command=[Console]::In.ReadLine();if($command -notmatch '^pid (\d+)$'){exit 0};$TargetProcessId=[int]$Matches[1]}
$deadline=[DateTime]::UtcNow.AddSeconds(40)
$fullscreenSince=$null
while([DateTime]::UtcNow -lt $deadline){
 if(-not(Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)){exit 0}
 $handle=[NxeWindow]::FindWindow([uint32]$TargetProcessId)
 [NxeWindow]::Shield([IntPtr]$KioskWindowHandle,$handle)
 if([NxeWindow]::Fullscreen($handle)){if($null -eq $fullscreenSince){$fullscreenSince=[DateTime]::UtcNow}}else{$fullscreenSince=$null}
 if($null -ne $fullscreenSince -and ([DateTime]::UtcNow-$fullscreenSince).TotalMilliseconds -ge $SettleMs){
  [Console]::Out.WriteLine('fullscreen');[Console]::Out.Flush()
  if([Console]::In.ReadLine() -eq 'release' -and (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)){
   $handle=[NxeWindow]::FindWindow([uint32]$TargetProcessId)
      if($handle -ne [IntPtr]::Zero){[NxeWindow]::Reveal([IntPtr]$KioskWindowHandle,$handle)}
  }
  exit 0
 }
 Start-Sleep -Milliseconds 50
}
$handle=[NxeWindow]::FindWindow([uint32]$TargetProcessId)
if($handle -ne [IntPtr]::Zero){[NxeWindow]::Reveal([IntPtr]$KioskWindowHandle,$handle)}
[Console]::Error.WriteLine('Fullscreen settling timed out; revealing the emulator as a fallback.')
exit 2
