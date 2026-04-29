param (
    [Parameter(Mandatory=$true)]
    [string]$Target
)

switch ($Target) {
    "push-staging" {
        Write-Host "📦 Отправляем develop → staging → GitHub..." -ForegroundColor Cyan
        $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
        if ($currentBranch -ne "develop") {
            Write-Host "❌ Сейчас на ветке '$currentBranch'. Переключись на develop: git checkout develop" -ForegroundColor Red
            exit 1
        }
        
        $status = (git status --porcelain)
        if ($status) {
            Write-Host "❌ Есть несохранённые изменения! Сделай commit." -ForegroundColor Red
            git status --short
            exit 1
        }

        git checkout staging
        git merge develop
        git push origin staging
        git checkout develop
        Write-Host "✅ Запушено в staging. GitHub Actions деплоит на сервер." -ForegroundColor Green
    }

    "push-prod" {
        Write-Host "🚀 Отправляем staging → main → GitHub..." -ForegroundColor Magenta
        $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
        if ($currentBranch -ne "staging" -and $currentBranch -ne "develop") {
            Write-Host "❌ Переключись на staging или develop перед push-prod" -ForegroundColor Red
            exit 1
        }

        git checkout main
        git merge staging
        git push origin main
        git checkout develop
        Write-Host "✅ Запушено в main. GitHub Actions деплоит на production." -ForegroundColor Green
    }

    "status" {
        Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Yellow
        Write-Host "  ЗАПУЩЕННЫЕ КОНТЕЙНЕРЫ"
        Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        Write-Host ""
    }

    default {
        Write-Host "❌ Неизвестная команда: $Target" -ForegroundColor Red
        Write-Host "Доступные команды: push-staging, push-prod, status"
    }
}
