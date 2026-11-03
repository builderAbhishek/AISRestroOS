import asyncio
from datetime import datetime, timezone
from app.database.session import SessionLocal
from app.models.restaurant import Restaurant
from app.business_logic import backup_service
from app.core.logging import logger


async def auto_backup_loop():
    """
    Offline background worker that checks and triggers scheduled backups automatically.
    Works inside the desktop process without external cron or cloud services.
    """
    logger.info("Automatic backup background scheduler initialized.")
    while True:
        try:
            await asyncio.sleep(60)
            with SessionLocal() as db:
                restaurants = db.query(Restaurant).all()
                for r in restaurants:
                    s = r.settings
                    if not s or not s.auto_backup_enabled:
                        continue

                    target_time = s.auto_backup_time or "23:00"
                    now_utc = datetime.now(timezone.utc)
                    current_hhmm = now_utc.strftime("%H:%M")

                    # Check if already executed today
                    already_done_today = False
                    if s.last_backup_at:
                        try:
                            last_dt = datetime.fromisoformat(s.last_backup_at)
                            if last_dt.date() == now_utc.date():
                                already_done_today = True
                        except Exception:
                            pass

                    # If weekly, check if today is Sunday (day 6)
                    if s.auto_backup_interval == "weekly" and now_utc.weekday() != 6:
                        continue

                    if not already_done_today and current_hhmm == target_time:
                        logger.info(f"Running automated backup for '{r.name}' at {current_hhmm} UTC...")
                        try:
                            backup_service.create_backup(
                                db,
                                r.id,
                                destination_dir=s.auto_backup_path,
                                backup_type="automatic",
                            )
                            logger.info(f"Automated backup succeeded for '{r.name}'.")
                        except Exception as e:
                            logger.error(f"Automated backup failed for '{r.name}': {e}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in auto_backup_loop: {e}", exc_info=True)
