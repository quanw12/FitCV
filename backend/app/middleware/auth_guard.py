from collections.abc import Callable

from fastapi import HTTPException, status

from app.models.account import Account, AccountRole


def require_role(*allowed_roles: AccountRole) -> Callable[[Account], Account]:
    def guard(account: Account) -> Account:
        if account.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permission.")
        return account

    return guard
