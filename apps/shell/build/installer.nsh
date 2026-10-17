; Keeps the genoffice command line (resources\cli, holding genoffice.cmd and the
; extension-less genoffice for Git Bash) on the installing user's PATH for the
; lifetime of the install. The value is read and written unexpanded
; (REG_EXPAND_SZ) so entries such as %USERPROFILE%\bin survive, and Explorer
; is told about the change so terminals opened afterwards see it.
; electron-builder compiles the script twice (the second pass, with
; BUILD_UNINSTALLER, only produces the uninstaller); an unreferenced function
; in either pass is a warning makensis treats as an error, hence the guards.
!include "WinMessages.nsh"
!include "StrFunc.nsh"

!define GENOFFICE_PATH_MAX 7900

; Scope templates to our ProgIDs (electron-builder uses win.fileAssociations.name).
; A shared .ext\ShellNew would overwrite Office/WPS templates. OOXML files
; must be copied from valid packages, never created with NullFile.
!macro GenOfficeRegisterShellNew EXT PROGID
  WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew" "FileName" "$INSTDIR\resources\shell-new\blank.${EXT}"
!macroend

!macro GenOfficeUnregisterShellNew EXT PROGID
  ; Only remove our own registration, including when uninstalling for an update.
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew" "FileName"
  ${If} $0 == "$INSTDIR\resources\shell-new\blank.${EXT}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}"
  ${EndIf}
!macroend

; .odt is only offered in Explorer's "Open with": a product-own ProgId plus a
; value under .odt\OpenWithProgids. A win.fileAssociations entry would also
; write .odt's default value (APP_ASSOCIATE) and take over the user's ODT
; program, so ODT is registered here instead. ODT opens in the Word tab, so the
; ProgId borrows the Word icon the installer already places for .docx.
!define GENOFFICE_ODT_PROGID "IeumOffice.OpenDocumentText"

!macro GenOfficeRegisterOpenWithOdt
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_ODT_PROGID}" "" "OpenDocument Text"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_ODT_PROGID}\DefaultIcon" "" "$INSTDIR\resources\docx.ico"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_ODT_PROGID}\shell\open\command" "" '"$appExe" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.odt\OpenWithProgids" "${GENOFFICE_ODT_PROGID}"
!macroend

!macro GenOfficeUnregisterOpenWithOdt
  ; Only our value and our ProgId: the .odt key, its default value and other
  ; programs' OpenWithProgids entries belong to whoever wrote them.
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.odt\OpenWithProgids" "${GENOFFICE_ODT_PROGID}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${GENOFFICE_ODT_PROGID}"
!macroend

; .hwp, .hwpx and .xmind are offered in Explorer's "Open with" and never made
; the default, for the same reason as .odt above: a win.fileAssociations entry
; would also write the extension's default value and take it over (from Hancom
; Office for the Hangul formats, from whatever opens the mind map today). Each
; gets a product-own ProgId whose DefaultIcon is the per-type document icon
; (resources\hwp.ico / resources\mindmap.ico, placed by the win.extraResources
; entries in electron-builder.cjs), so choosing this app in "Open with" shows
; the Hangul or mind-map icon instead of the bare app icon. The ProgIds match
; the name-to-ProgId rule electron-builder.cjs uses for its Windows list
; (see tests/product-identity.test.ts).
!define GENOFFICE_HWP_PROGID "IeumOffice.HWPDocument"
!define GENOFFICE_HWPX_PROGID "IeumOffice.HWPXDocument"
!define GENOFFICE_MINDMAP_PROGID "IeumOffice.MindMap"

!macro GenOfficeRegisterOpenWithHwp
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWP_PROGID}" "" "HWP Document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWP_PROGID}\DefaultIcon" "" "$INSTDIR\resources\hwp.ico"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWP_PROGID}\shell\open\command" "" '"$appExe" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.hwp\OpenWithProgids" "${GENOFFICE_HWP_PROGID}"
!macroend

!macro GenOfficeUnregisterOpenWithHwp
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.hwp\OpenWithProgids" "${GENOFFICE_HWP_PROGID}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWP_PROGID}"
!macroend

!macro GenOfficeRegisterOpenWithHwpx
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWPX_PROGID}" "" "HWPX Document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWPX_PROGID}\DefaultIcon" "" "$INSTDIR\resources\hwp.ico"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWPX_PROGID}\shell\open\command" "" '"$appExe" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.hwpx\OpenWithProgids" "${GENOFFICE_HWPX_PROGID}"
!macroend

!macro GenOfficeUnregisterOpenWithHwpx
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.hwpx\OpenWithProgids" "${GENOFFICE_HWPX_PROGID}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${GENOFFICE_HWPX_PROGID}"
!macroend

!macro GenOfficeRegisterOpenWithMindmap
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_MINDMAP_PROGID}" "" "Mind Map"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_MINDMAP_PROGID}\DefaultIcon" "" "$INSTDIR\resources\mindmap.ico"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${GENOFFICE_MINDMAP_PROGID}\shell\open\command" "" '"$appExe" "%1"'
  WriteRegNone SHELL_CONTEXT "Software\Classes\.xmind\OpenWithProgids" "${GENOFFICE_MINDMAP_PROGID}"
!macroend

!macro GenOfficeUnregisterOpenWithMindmap
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.xmind\OpenWithProgids" "${GENOFFICE_MINDMAP_PROGID}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${GENOFFICE_MINDMAP_PROGID}"
!macroend

!macro customInstall
  Push "$INSTDIR\resources\cli"
  Call GenOfficeAddToUserPath
  !insertmacro GenOfficeRegisterShellNew "docx" "IeumOffice.WordDocument"
  !insertmacro GenOfficeRegisterShellNew "xlsx" "IeumOffice.ExcelWorkbook"
  !insertmacro GenOfficeRegisterShellNew "pptx" "IeumOffice.PowerPointPresentation"
  !insertmacro GenOfficeRegisterOpenWithOdt
  !insertmacro GenOfficeRegisterOpenWithHwp
  !insertmacro GenOfficeRegisterOpenWithHwpx
  !insertmacro GenOfficeRegisterOpenWithMindmap
  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  Push "$INSTDIR\resources\cli"
  Call un.GenOfficeRemoveFromUserPath
  Push $0
  !insertmacro GenOfficeUnregisterShellNew "docx" "IeumOffice.WordDocument"
  !insertmacro GenOfficeUnregisterShellNew "xlsx" "IeumOffice.ExcelWorkbook"
  !insertmacro GenOfficeUnregisterShellNew "pptx" "IeumOffice.PowerPointPresentation"
  !insertmacro GenOfficeUnregisterOpenWithOdt
  !insertmacro GenOfficeUnregisterOpenWithHwp
  !insertmacro GenOfficeUnregisterOpenWithHwpx
  !insertmacro GenOfficeUnregisterOpenWithMindmap
  Pop $0
  !insertmacro UPDATEFILEASSOC
!macroend

!ifndef BUILD_UNINSTALLER
${StrStr}

Function GenOfficeAddToUserPath
  Exch $0 ; directory
  Push $1
  Push $2
  Push $3
  ReadRegStr $1 HKCU "Environment" "Path"
  StrLen $2 $1
  ; leave an already oversized PATH alone rather than truncate it
  IntCmp $2 ${GENOFFICE_PATH_MAX} done 0 done
  ${StrStr} $3 ";$1;" ";$0;"
  StrCmp $3 "" 0 done
  StrCmp $1 "" 0 +3
    StrCpy $1 "$0"
    Goto write
  StrCpy $1 "$1;$0"
write:
  WriteRegExpandStr HKCU "Environment" "Path" $1
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!endif

!ifdef BUILD_UNINSTALLER
${UnStrStr}
${UnStrRep}

Function un.GenOfficeRemoveFromUserPath
  Exch $0 ; directory
  Push $1
  Push $2
  ReadRegStr $1 HKCU "Environment" "Path"
  StrCmp $1 "" done
  ${UnStrStr} $2 ";$1;" ";$0;"
  StrCmp $2 "" done
  StrCpy $1 ";$1;"
  ${UnStrRep} $1 $1 ";$0;" ";"
  ; strip the sentinels added above
  StrCpy $1 $1 -1
  StrCpy $1 $1 "" 1
  WriteRegExpandStr HKCU "Environment" "Path" $1
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
done:
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!endif
