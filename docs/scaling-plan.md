# Anita Psy - Scaling & Maintenance Plan

## 1. Vertical Scaling (Phase 1)
As the number of users grows, the first step is to increase the VPS resources (CPU/RAM).
- **Target**: 2 CPU, 4GB RAM can comfortably handle ~50-100 concurrent sessions.
- **Monitoring**: Use `htop` and `docker stats` to monitor resource usage.

## 2. Horizontal Scaling (Phase 2)
If vertical scaling is not enough:
- **Load Balancer**: Use Nginx or HAProxy as a load balancer in front of multiple backend containers.
- **Stateless Backend**: The backend is already mostly stateless (JWT based).
- **Sticky Sessions**: If using WebSockets (not currently used) or SSE with long-polling, ensure sticky sessions.
- **Database**: Move PostgreSQL to a managed service (RDS, Google Cloud SQL) or a separate dedicated server.

## 3. Database Maintenance
- **Backups**: Run `scripts/backup-db.ps1` daily.
- **Cleanup**: The `messages` table has an `expires_at` column. Ensure a cron job runs `DELETE FROM messages WHERE expires_at < NOW()` periodically.
- **Vacuuming**: Postgres `autovacuum` should be enabled, but manual `VACUUM ANALYZE` after large deletions is recommended.

## 4. Monitoring & Alerts
- **Uptime**: Use [UptimeRobot](https://uptimerobot.com/) or [Gatus](https://github.com/TwiN/gatus) pointed at `/api/health`.
- **Alerts**: Integrate Telegram/Slack webhooks in your monitoring tool to receive instant notifications if the health check fails.
- **Errors**: Check Sentry dashboard for spikes in 500 errors.
- **Logs**: Periodically check `docker logs anita-backend` for warnings.

## 5. Performance & Caching
- **Indexes**: Periodically review slow queries via `pg_stat_statements` and add indexes where needed.
- **Caching**: If API latency increases, implement **Redis** to cache:
  - User sessions (reduce DB load on `requireAuth`).
  - Frequently accessed analytics (like `technique_stats`).
  - Rate limiting buckets.

## 5. Security
- **Fail2Ban**: Install on the host to protect SSH and potentially block IPs that spam the `/api` endpoints (though we have internal `checkBlacklist`).
- **HTTPS**: Always use Certbot (Let's Encrypt) for SSL.
