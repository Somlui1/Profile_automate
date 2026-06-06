@echo off
set "commit_msg=%~1"
if "%commit_msg%"=="" (
    set "commit_msg=."
)

git add .
git commit -m "%commit_msg%"
git push -u origin main