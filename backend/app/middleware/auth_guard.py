from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_account
from app.models.account import Account, AccountRole


def require_role(*allowed_roles: AccountRole) -> Callable[..., Account]:
    def guard(account: Account = Depends(get_current_account)) -> Account:
        if account.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permission.")
        return account

    return guard
