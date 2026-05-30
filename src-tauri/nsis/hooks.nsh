; Magpie NSIS 安装/卸载钩子
; 由 tauri.windows.conf.json 的 bundle.windows.nsis.installerHooks 引用，仅 Windows 平台使用。
; 设计依据：需求 1（A2 卸载体验改善）。

!include "LogicLib.nsh"
!include "WinMessages.nsh"

; 检测 Magpie.exe 是否在运行：
; 通过 tasklist 按进程名过滤，再交给 find 判断；find 命中时退出码为 0。
; 结果写入 RESULT：字符串 "0" 表示进程在运行，其他值表示未运行。
!macro MagpieProcRunning RESULT
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq Magpie.exe" /NH | "$SYSDIR\find.exe" /I "Magpie.exe"'
  Pop ${RESULT}
  Pop $R9
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro MagpieProcRunning $R0

  ${If} $R0 == "0"
    ${IfNot} ${Silent}
      ; 需求 1.1：交互卸载且进程在运行 —— 友好提示并终止本次卸载，等用户自行关闭后重试。
      MessageBox MB_OK|MB_ICONEXCLAMATION "请先关闭 Magpie 后重试。"
      Abort
    ${Else}
      ; 需求 1.2：静默卸载（命令行含 /S）跳过提示弹窗。
      ; 需求 1.3：向主窗口发送 WM_CLOSE，触发应用的正常关闭流程。
      FindWindow $R1 "" "Magpie"
      ${If} $R1 <> 0
        SendMessage $R1 ${WM_CLOSE} 0 0 /TIMEOUT=1000
      ${EndIf}

      ; 需求 1.4：轮询最多 5 秒（10 次 × 500ms）等待进程退出。
      StrCpy $R2 0
      ${DoWhile} $R2 < 10
        Sleep 500
        !insertmacro MagpieProcRunning $R0
        ${If} $R0 != "0"
          ${ExitDo}
        ${EndIf}
        IntOp $R2 $R2 + 1
      ${Loop}

      ; 需求 1.4：5 秒后仍未退出则强制结束进程作为兜底。
      ${If} $R0 == "0"
        nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM Magpie.exe'
        Sleep 500
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Restoring Windows Clipboard settings..."

  ; 1. 将剪贴板历史/云剪贴板恢复为默认开启（1），
  ;    确保即便应用曾禁用过 Win+V，卸载后系统功能仍可用。
  WriteRegDWORD HKCU "Software\Microsoft\Clipboard" "EnableClipboardHistory" 1
  WriteRegDWORD HKCU "Software\Microsoft\Clipboard" "EnableCloudClipboard" 1

  ; 2. 从 DisabledHotkeys 中移除 'V'（接管 Win+V 时写入的标记）。
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "DisabledHotkeys"
  ${If} $0 != ""
    Push "V"
    Push ""
    Push $0
    Call un.StrReplace
    Pop $0

    Push "v"
    Push ""
    Push $0
    Call un.StrReplace
    Pop $0

    ${If} $0 == ""
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "DisabledHotkeys"
    ${Else}
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "DisabledHotkeys" $0
    ${EndIf}
  ${EndIf}

  ; 3. 清理可能残留的剪贴板策略与自启动项。
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" "DisallowClipboardHistory"
  DeleteRegValue HKCU "Software\Policies\Microsoft\Windows\System" "AllowClipboardHistory"
  DeleteRegValue HKCU "Software\Policies\Microsoft\Windows\System" "AllowCrossDeviceClipboard"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Magpie"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TieZ"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "tie-z"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "tiez-app"
  ; 清理 NSIS 记录的上次安装路径，避免后续静默安装继续复用旧目录。
  DeleteRegKey HKCU "Software\magpie\Magpie"
  DeleteRegKey /ifempty HKCU "Software\magpie"
  DeleteRegKey HKCU "Software\tiez\TieZ"
  DeleteRegKey /ifempty HKCU "Software\tiez"

  DetailPrint "Windows Clipboard settings restored."

  ; 4. 重启资源管理器以使 DisabledHotkeys 变更生效（静默执行，尽量不打扰用户）。
  DetailPrint "Restarting Explorer to apply changes..."
  nsExec::Exec '"powershell.exe" -NoProfile -WindowStyle Hidden -Command "Stop-Process -Name explorer -Force; Start-Process explorer"'
  DetailPrint "Explorer restarted."

  ; 5. 卸载器退出后异步清理可能残留的安装目录（exe 仍被占用时第一次删不掉）。
  DetailPrint "Scheduling leftover install directory cleanup..."
  nsExec::Exec '"$SYSDIR\cmd.exe" /C start "" /MIN powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Stop-Process -Name Magpie,TieZ,tiez-app -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath ''$INSTDIR'' -Force -Recurse -ErrorAction SilentlyContinue"'
!macroend

; 字符串替换函数（卸载器版本），供 POSTUNINSTALL 移除 DisabledHotkeys 中的 'V'。
Function un.StrReplace
  Exch $0 ; 原始字符串（输入/输出）
  Exch
  Exch $1 ; 替换为
  Exch
  Exch 2
  Exch $2 ; 待替换子串
  Exch 2
  Push $3 ; 待替换子串长度
  Push $4 ; 当前原始字符串长度
  Push $5 ; 替换串长度
  Push $6 ; 当前索引
  Push $7 ; 当前子串

  StrLen $3 $2
  ${If} $3 == 0
    Goto StrReplace_End
  ${EndIf}

  StrLen $4 $0
  StrLen $5 $1
  StrCpy $6 0

  StrReplace_Loop:
    StrCpy $7 $0 $3 $6
    ${If} $7 == $2
      StrCpy $7 $0 $6 ; 匹配前的文本
      IntOp $6 $6 + $3
      StrCpy $0 $0 "" $6 ; 匹配后的文本
      StrCpy $0 $7$1$0 ; 拼成新串
      StrLen $4 $0 ; 新长度
      IntOp $6 $7 + $5 ; 索引跳过替换串
    ${Else}
      IntOp $6 $6 + 1
    ${EndIf}

    ${If} $6 < $4
      Goto StrReplace_Loop
    ${EndIf}

  StrReplace_End:
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd
