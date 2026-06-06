param(
    [string]$CommitMsg = "."
)

git add .
git commit -m $CommitMsg
git push -u origin main