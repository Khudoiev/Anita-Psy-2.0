# Git History Audit

В истории коммитов обнаружены значительные дублирования, вероятно, из-за rebase/merge или force push операций между ветками `main`, `develop` и `staging` без корректной синхронизации.

## Дубликаты коммитов
1. **chore: ignore .claude settings**
   - `7558812`
   - `41d801b`
   - `c6e47d8`
2. **fix: CORS blocks admin login on separate port + dotenv path for local dev**
   - `7475108`
   - `4e5b669`
3. **fix: split frontend/admin to separate ports, fix staging nginx, add Makefile**
   - `13cabe0`
   - `7f38332`
4. **fix: allow staging access via IP (since DNS is not set)**
   - `a1f6331`
   - `a2ecb71`
5. **fix: change staging ports to 8081/4431 to avoid conflict**
   - `6dd6f9c`
   - `e69fa28`
6. **fix: correct build context and schema path in staging-server docker-compose**
   - `3b730dd`
   - `debced8`

**Решение (Фаза 1.5):** 
Необходимо провести интерактивный rebase для ветки `main`, начиная с коммита `467ed94` (или `debced8`), удалив дублирующиеся коммиты (drop). Затем синхронизировать ветки.
