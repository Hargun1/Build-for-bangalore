import hmac

from fastapi import Header, HTTPException

from .config import get_settings


async def require_internal_token(x_internal_token: str = Header(default="")) -> None:
    """Only the Node backend may call this service.

    When AI_INTERNAL_TOKEN is set (always in production), requests must carry the
    same value in the X-Internal-Token header. Without this, anyone who found the
    service URL could spend the free-tier AI quota.
    """
    expected = get_settings().internal_token
    if not expected:
        return
    if not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Missing or invalid internal token")
