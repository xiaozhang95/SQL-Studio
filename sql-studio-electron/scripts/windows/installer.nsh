!ifndef BUILD_UNINSTALLER
  Var PreviousInstallDir
  Var PreviousDataBackup
!endif

!macro StopSetup MESSAGE
  MessageBox MB_OK|MB_ICONSTOP "${MESSAGE}" /SD IDOK
  SetErrorLevel 2
  Abort
!macroend

; Keep the built-in language tables and fall back to English for custom errors.
!macro StopSetupLocalized ENGLISH SIMPLIFIED_CHINESE
  StrCpy $0 "${ENGLISH}"
  !ifdef LANG_SIMPCHINESE
    ${If} $LANGUAGE == ${LANG_SIMPCHINESE}
      StrCpy $0 "${SIMPLIFIED_CHINESE}"
    ${EndIf}
  !endif
  !insertmacro StopSetup "$0"
!macroend

!macro StopSetupDataMoveFailed
  !insertmacro StopSetupLocalized "Could not preserve SQL Studio data. Check this folder: $PreviousInstallDir" "无法保留 SQL Studio 配置，请检查目录：$PreviousInstallDir"
!macroend

!macro CloseSqlStudio DIRECTORY
  ${If} ${FileExists} "${DIRECTORY}\${APP_EXECUTABLE_FILENAME}"
  ${OrIf} ${FileExists} "${DIRECTORY}\sql-studio-runtime.exe"
  ${OrIf} ${FileExists} "${DIRECTORY}\resources\runtime\sql-studio-backend.exe"
    !insertmacro CloseSqlStudioProcesses "${DIRECTORY}"
  ${EndIf}
!macroend

!macro CloseSqlStudioProcesses DIRECTORY
  ; Pass paths through the environment so directory names are never parsed as PowerShell code.
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SQL_STUDIO_SETUP_DIR", w "${DIRECTORY}")'
  ${Do}
    StrCpy $R8 0
    ${Do}
      nsExec::Exec /TIMEOUT=15000 `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "& { try { \
        $$root = $$env:SQL_STUDIO_SETUP_DIR; \
        $$backend = Join-Path $$root 'resources\runtime\sql-studio-backend.exe'; \
        $$desktop = @('${APP_EXECUTABLE_FILENAME}', 'sql-studio-runtime.exe') | ForEach-Object { Join-Path $$root $$_ }; \
        $$running = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $$_.ExecutablePath -in $$desktop -or $$_.ExecutablePath -eq $$backend }); \
        if (!$$running.Count) { exit 0 }; \
        $$windows = @($$running | Where-Object { $$_.ExecutablePath -in $$desktop }); \
        if ($$windows.Count) { \
          $$windows | ForEach-Object { \
            $$process = Get-Process -Id $$_.ProcessId -ErrorAction SilentlyContinue; \
            if ($$process) { [void] $$process.CloseMainWindow() } \
          } \
        } else { \
          $$running | ForEach-Object { Stop-Process -Id $$_.ProcessId -ErrorAction SilentlyContinue } \
        }; \
        exit 1 \
      } catch { exit 2 } }"`
      Pop $R9
      ${If} $R9 == "0"
        ${ExitDo}
      ${EndIf}
      ${If} $R9 != "1"
        !insertmacro StopSetupLocalized "Could not check running SQL Studio processes. Setup stopped." "无法检查 SQL Studio 进程，安装或卸载已停止。"
      ${EndIf}
      Sleep 600
      IntOp $R8 $R8 + 1
    ${LoopUntil} $R8 >= 5
    ${If} $R9 == "0"
      ${ExitDo}
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY +3
      SetErrorLevel 2
      Abort
  ${Loop}
  System::Call 'Kernel32::SetEnvironmentVariableW(w "SQL_STUDIO_SETUP_DIR", p 0)'
!macroend

!macro customCheckAppRunning
  !ifdef BUILD_UNINSTALLER
    ; The stock silent uninstaller invokes this hook before setting shell context.
    !insertmacro CloseSqlStudio "$INSTDIR"
  !else
    SetOutPath "$TEMP"
    !insertmacro CloseSqlStudio "$INSTDIR"
    !insertmacro ProtectPreviousInstallData HKLM
  !endif
!macroend

!macro ProtectPreviousInstallData ROOT_KEY
  StrCpy $PreviousDataBackup ""
  ReadRegStr $PreviousInstallDir ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $PreviousInstallDir != ""
    GetFullPathName $PreviousInstallDir "$PreviousInstallDir\."
    ${If} $PreviousInstallDir != $INSTDIR
      !insertmacro CloseSqlStudio "$PreviousInstallDir"
    ${EndIf}

    ; Older uninstallers recursively remove the install folder, including its data.
    StrCpy $PreviousDataBackup "$PreviousInstallDir.sql-studio-upgrade"
    ${If} ${FileExists} "$PreviousInstallDir\.sql-studio\*.*"
      ClearErrors
      Rename "$PreviousInstallDir\.sql-studio" "$PreviousDataBackup"
      ${If} ${Errors}
        !insertmacro StopSetupDataMoveFailed
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro RestorePreviousInstallData
  ; Save the old uninstaller result before restoring the data or clearing NSIS errors.
  StrCpy $R8 $R0
  ${If} ${Errors}
  ${AndIf} $PreviousInstallDir != ""
  ${AndIf} ${FileExists} "$PreviousInstallDir\${UNINSTALL_FILENAME}"
    StrCpy $R8 2
  ${EndIf}
  ClearErrors

  ${If} $PreviousDataBackup != ""
  ${AndIf} ${FileExists} "$PreviousDataBackup\*.*"
    CreateDirectory "$PreviousInstallDir"
    ClearErrors
    Rename "$PreviousDataBackup" "$PreviousInstallDir\.sql-studio"
    ${If} ${Errors}
      !insertmacro StopSetupDataMoveFailed
    ${EndIf}
  ${EndIf}

  ${If} $R8 != "0"
    !insertmacro StopSetup "$(uninstallFailed) ($R8)"
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro RestorePreviousInstallData
  ; The all-users setup checks HKLM first, then looks for the old per-user install in HKCU.
  !insertmacro ProtectPreviousInstallData HKCU
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro RestorePreviousInstallData
  ; Check an orphaned or locked uninstaller before extracting the new application.
  ${If} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
    StrCpy $R8 0
    ${Do}
      ClearErrors
      Delete "$INSTDIR\${UNINSTALL_FILENAME}"
      ${IfNot} ${Errors}
        ${ExitDo}
      ${EndIf}
      IntOp $R8 $R8 + 1
      Sleep 300
    ${LoopUntil} $R8 >= 5
    ${If} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
      !insertmacro StopSetupLocalized "Could not replace the previous uninstaller. Close any running setup or uninstall program and check this file: $INSTDIR\${UNINSTALL_FILENAME}" "无法替换旧卸载程序。请关闭正在运行的安装或卸载程序，并检查此文件：$INSTDIR\${UNINSTALL_FILENAME}"
    ${EndIf}
  ${EndIf}
!macroend

!macro customRemoveFiles
  ; Keep local configuration when the user uninstalls. Upgrades protect it in the installer.
  SetOutPath "$TEMP"
  ${If} ${isUpdated}
  ${AndIfNot} ${FileExists} "$INSTDIR\.sql-studio\*.*"
    CreateDirectory "$PLUGINSDIR\old-install"
    Push ""
    Call un.atomicRMDir
    Pop $R0
    ${If} $R0 != 0
      Push ""
      Call un.restoreFiles
      Pop $R0
      SetErrorLevel 2
      Abort
    ${EndIf}
  ${EndIf}

  FindFirst $R0 $R1 "$INSTDIR\*.*"
  ${DoWhile} $R1 != ""
    ${If} $R1 != "."
    ${AndIf} $R1 != ".."
    ${AndIf} $R1 != ".sql-studio"
      ${If} ${FileExists} "$INSTDIR\$R1\*.*"
        RMDir /r "$INSTDIR\$R1"
      ${Else}
        Delete "$INSTDIR\$R1"
      ${EndIf}
    ${EndIf}
    FindNext $R0 $R1
  ${Loop}
  FindClose $R0
  RMDir "$INSTDIR"
!macroend
