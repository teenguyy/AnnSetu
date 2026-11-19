"""Email adapters: Resend (HTTP API) or SMTP. With neither configured, sending is disabled and
messages are only logged; nothing is reported as delivered."""

import asyncio
import html
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

log = logging.getLogger("annsetu.email")


@dataclass
class Email:
    to: str
    subject: str
    text: str
    html: str


class EmailDisabledError(RuntimeError):
    pass


def render(title: str, body: str | None, link: str | None) -> Email:
    """Plain, accessible email in the AnnSetu palette."""
    s = get_settings()
    url = f"{s.public_site_url}{link}" if link and link.startswith("/") else link
    text = "\n\n".join(p for p in (title, body, url and f"Open AnnSetu: {url}") if p)
    button = (
        f'<p><a href="{html.escape(url)}" style="display:inline-block;background:#FFE28A;color:#102F46;'
        f'padding:14px 28px;border-radius:999px;font-weight:600;text-decoration:none">Open AnnSetu →</a></p>'
        if url else ""
    )
    page = (
        '<div style="background:#D6ECF4;padding:32px;font-family:Arial,sans-serif;color:#102F46">'
        '<div style="max-width:560px;margin:auto;background:#F2F9FC;border-radius:24px;padding:32px">'
        '<p style="font-size:13px;letter-spacing:.12em;color:#287FA6;margin:0 0 8px">ANNSETU</p>'
        f'<h1 style="font-size:22px;margin:0 0 12px">{html.escape(title)}</h1>'
        f'<p style="font-size:16px;line-height:1.5">{html.escape(body or "")}</p>{button}'
        '<p style="font-size:12px;color:#3A5C74;margin-top:24px">You receive this because of your AnnSetu account. '
        'Change email preferences in Settings → Notifications.</p></div></div>'
    )
    return Email(to="", subject=title, text=text, html=page)


async def send(mail: Email) -> str:
    s = get_settings()
    if s.resend_api_key:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {s.resend_api_key}"},
                json={"from": s.email_from, "to": [mail.to], "subject": mail.subject,
                      "text": mail.text, "html": mail.html},
            )
            r.raise_for_status()
            return "resend"
    if s.smtp_host:
        await asyncio.to_thread(_smtp_send, mail)
        return "smtp"
    log.info("email disabled (no provider configured)", extra={"subject": mail.subject})
    raise EmailDisabledError("No email provider configured")


def _smtp_send(mail: Email) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.email_from, mail.to, mail.subject
    msg.set_content(mail.text)
    msg.add_alternative(mail.html, subtype="html")
    with smtplib.SMTP(s.smtp_host or "", s.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if s.smtp_user:
            smtp.login(s.smtp_user, s.smtp_password or "")
        smtp.send_message(msg)
