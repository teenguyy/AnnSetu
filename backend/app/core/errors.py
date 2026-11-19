"""Translate database errors raised by the SQL business functions into clean HTTP responses.

The functions raise with SQLSTATE P0001 (rule violation, message safe to show), P0002 (not found)
or 42501 (forbidden). Anything else becomes a generic 500 without internal details.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError

log = logging.getLogger("annsetu")

_STATUS = {"P0001": 400, "P0002": 404, "42501": 403, "23505": 409, "23514": 422, "22P02": 422}


def _sqlstate(exc: DBAPIError) -> str | None:
    orig = getattr(exc, "orig", None)
    return getattr(orig, "sqlstate", None) or getattr(getattr(orig, "__cause__", None), "sqlstate", None)


def _message(exc: DBAPIError) -> str:
    orig = getattr(exc, "orig", None)
    cause = getattr(orig, "__cause__", None)
    msg = getattr(cause, "message", None) or str(orig)
    return msg.split("\n")[0].removeprefix("ERROR:").strip()


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DBAPIError)
    async def db_error(request: Request, exc: DBAPIError) -> JSONResponse:
        code = _sqlstate(exc)
        status = _STATUS.get(code or "")
        rid = getattr(request.state, "request_id", None)
        if status is None:
            log.exception("database error", extra={"request_id": rid})
            return JSONResponse({"detail": "Something went wrong. Please try again.", "request_id": rid}, 500)
        if code == "42501" and "permission denied" in _message(exc).lower():
            return JSONResponse({"detail": "Not allowed"}, 403)
        if code in {"23505", "23514", "22P02"}:
            return JSONResponse({"detail": "The data you sent conflicts with existing records or is invalid."}, status)
        return JSONResponse({"detail": _message(exc)}, status)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        rid = getattr(request.state, "request_id", None)
        log.exception("unhandled error", extra={"request_id": rid})
        return JSONResponse({"detail": "Something went wrong. Please try again.", "request_id": rid}, 500)
