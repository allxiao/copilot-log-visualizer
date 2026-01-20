@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "MITM_TO_JSON=%SCRIPT_DIR%..\mitm\mitm-to-json.py"

REM to stop the script, you need to press Ctrl+C twice in a row
REM the first Ctrl-C will show a prompt `Terminate batch job (Y/N)?`, if the result is captured, you won't see it.
call uvx --from mitmproxy mitmdump -q -s "%MITM_TO_JSON%" %*
