param(
  [Parameter(Mandatory=$true)][string]$User,
  [string]$Repo = "delisting-ledger",
  [string]$Token = $env:GITHUB_TOKEN,
  [string]$Email = "",
  [string]$CommitMessage = "feat: 退市到账 · A股退市赔偿兑现链数据平台"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not $Token) {
  Write-Host "缺少 Token。请先设置 `$env:GITHUB_TOKEN，或传 -Token。" -ForegroundColor Yellow
  Write-Host "建议使用 Fine-grained PAT：Contents / Pages / Administration 读写权限。" -ForegroundColor Yellow
  exit 1
}
if (-not $Email) { $Email = "$User@users.noreply.github.com" }

$headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "delisting-ledger-deploy"
}

Write-Host "==> 检查 GitHub 账号" -ForegroundColor Cyan
$me = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -Method Get
Write-Host "    已认证：$($me.login)" -ForegroundColor Green
if ($me.login -ne $User) {
  Write-Host "    警告：Token 属于 $($me.login)，与 -User $User 不一致；将以 $($me.login) 为准。" -ForegroundColor Yellow
  $User = $me.login
}

Write-Host "==> 创建仓库（若已存在则跳过）" -ForegroundColor Cyan
$body = @{
  name = $Repo
  description = "退市到账：A股退市中小投资者赔偿兑现链数据平台（L→PEU→R）"
  homepage = "https://$User.github.io/$Repo/"
  private = $false
  has_issues = $true
  has_wiki = $false
  auto_init = $false
} | ConvertTo-Json
try {
  Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Headers $headers -Method Post -Body $body | Out-Null
  Write-Host "    已创建 $User/$Repo" -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 422) {
    Write-Host "    仓库已存在，继续推送。" -ForegroundColor Yellow
  } else { throw }
}

Write-Host "==> 初始化并提交" -ForegroundColor Cyan
if (-not (Test-Path ".git")) { git init | Out-Null }
git config user.name "$User" | Out-Null
git config user.email "$Email" | Out-Null
git add -A
git -c core.quotepath=false commit -m $CommitMessage 2>$null | Out-Null
git branch -M main
$branches = git branch --list main
if (-not $branches) { git checkout -b main | Out-Null }

Write-Host "==> 推送 main" -ForegroundColor Cyan
$authUrl = "https://x-access-token:$Token@github.com/$User/$Repo.git"
git remote remove origin 2>$null | Out-Null
git remote add origin $authUrl
git push -u origin main --force
git remote set-url origin "https://github.com/$User/$Repo.git"

Write-Host "==> 开启 GitHub Pages" -ForegroundColor Cyan
$pagesBody = @{ source = @{ branch = "main"; path = "/" } } | ConvertTo-Json -Depth 4
try {
  Invoke-RestMethod -Uri "https://api.github.com/repos/$User/$Repo/pages" -Headers $headers -Method Post -Body $pagesBody | Out-Null
  Write-Host "    Pages 已启用" -ForegroundColor Green
} catch {
  try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/$User/$Repo/pages" -Headers $headers -Method Put -Body $pagesBody | Out-Null
    Write-Host "    Pages 已更新" -ForegroundColor Green
  } catch {
    Write-Host "    自动开启 Pages 失败（可能 Token 缺少 Pages 权限）。" -ForegroundColor Yellow
    Write-Host "    请手动：Settings → Pages → Source: Deploy from a branch → main / (root)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor DarkGray
Write-Host " 发布完成" -ForegroundColor Green
Write-Host " 仓库：https://github.com/$User/$Repo"
Write-Host " 站点：https://$User.github.io/$Repo/   （首次生效约 1–2 分钟）"
Write-Host "==============================================" -ForegroundColor DarkGray
