$Target = $args[0]

if (-not $Target) {
    Write-Host "[ERROR] Не указана команда (Target)" -ForegroundColor Red
    exit 1
}

switch ($Target) {
    "push-staging" {
        Write-Host ">>> Отправляем develop -> staging -> GitHub..." -ForegroundColor Cyan
        $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
        if ($currentBranch -ne "develop") {
            Write-Host "[ERROR] Сейчас на ветке '$currentBranch'. Переключись на develop: git checkout develop" -ForegroundColor Red
            exit 1
        }
        
        $status = (git status --porcelain)
        if ($status) {
            Write-Host "[ERROR] Есть несохранённые изменения! Сделай commit." -ForegroundColor Red
            git status --short
            exit 1
        }

        Write-Host "--- Switching to staging ---" -ForegroundColor Gray
        git checkout staging
        Write-Host "--- Merging develop ---" -ForegroundColor Gray
        git merge develop
        Write-Host "--- Pushing to origin staging ---" -ForegroundColor Gray
        git push origin staging
        Write-Host "--- Returning to develop ---" -ForegroundColor Gray
        git checkout develop
        Write-Host "[SUCCESS] Запушено в staging. GitHub Actions деплоит на сервер." -ForegroundColor Green
    }

    "push-prod" {
        Write-Host ">>> Отправляем staging -> main -> GitHub..." -ForegroundColor Magenta
        $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
        
        Write-Host "--- Switching to main ---" -ForegroundColor Gray
        git checkout main
        Write-Host "--- Merging staging ---" -ForegroundColor Gray
        git merge staging
        Write-Host "--- Pushing to origin main ---" -ForegroundColor Gray
        git push origin main
        Write-Host "--- Returning to develop ---" -ForegroundColor Gray
        git checkout develop
        Write-Host "[SUCCESS] Запушено в main. GitHub Actions деплоит на production." -ForegroundColor Green
    }

    "status" {
        Write-Host "`n===================================================" -ForegroundColor Yellow
        Write-Host "  ЗАПУЩЕННЫЕ КОНТЕЙНЕРЫ"
        Write-Host "===================================================" -ForegroundColor Yellow
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        Write-Host ""
    }

    default {
        Write-Host "[ERROR] Неизвестная команда: $Target" -ForegroundColor Red
    }
}
