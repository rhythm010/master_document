# Database Logs - Simple Guide

## ✅ What's Already Configured

PostgreSQL is configured to log **all SQL statements** with timestamps and durations.

---

## 🔍 How to View Logs

### Option 1: Docker Desktop (Easiest)
1. Open Docker Desktop
2. Click on `backend-companion-db-1` container
3. Go to **Logs** tab
4. Watch all SQL queries in real-time while tests run ✨

### Option 2: Terminal
```bash
# Watch logs in real-time
docker compose logs -f db

# View recent logs
docker compose logs db --tail=50

# Filter for SQL operations only
docker compose logs db | grep -E "INSERT|SELECT|UPDATE|DELETE"
```

---

## 📊 What You'll See

During test execution, you'll see:

```sql
2026-04-25 20:06:30 UTC [142] companion@companion LOG:  execute s4: INSERT INTO "public"."users" (...)
2026-04-25 20:06:30 UTC [142] companion@companion LOG:  execute s5: INSERT INTO "public"."companion_profiles" (...)
2026-04-25 20:06:30 UTC [143] companion@companion LOG:  execute s6: SELECT "public"."companion_profiles".* FROM ...
2026-04-25 20:06:30 UTC [142] companion@companion LOG:  execute s7: DELETE FROM "public"."companion_profiles" ...
```

Every database operation during test execution is visible! 🎯

---

## 🎯 That's It!

No file capture, no complexity. Just run your tests and watch Docker logs.

**test-validator agent** will execute tests, and you can see all database activity in real-time.
