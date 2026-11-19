"""Grant the admin role to an existing account (the first admin, or recovery).

Usage: uv run python -m scripts.create_admin someone@example.com
The person must have signed up first. Subsequent admins are granted from the admin console
(admin_set_role), which is audited.
"""

import asyncio
import sys

from sqlalchemy import text

from app.core.db import dispose_engine, system_tx


async def main(email: str) -> int:
    async with system_tx() as conn:
        user_id = (await conn.execute(text("select id from auth.users where lower(email) = lower(:e)"),
                                      {"e": email})).scalar()
        if user_id is None:
            print(f"No account with email {email}. Ask them to sign up first.")
            return 1
        await conn.execute(text("update public.profiles set role = 'admin' where id = :u"), {"u": user_id})
        await conn.execute(text(
            "insert into public.audit_log (actor_name, action, target_table, target_id, target_label, note) "
            "values ('create_admin script', 'role_changed', 'profiles', cast(:u as text), :e, 'first admin')"),
            {"u": user_id, "e": email})
    await dispose_engine()
    print(f"{email} is now an admin.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1])))
