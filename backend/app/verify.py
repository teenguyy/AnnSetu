"""AI extraction prompt + deterministic verification + admin summary.

The AI only READS the document. Every pass/warn/fail decision below is plain
Python, so it is predictable and testable. Nothing here approves anything:
the admin always decides.
"""
import re
from datetime import date, datetime
from difflib import SequenceMatcher

EXTRACT_PROMPT = """You are reading an Indian organisation's verification document for a food-donation platform.
Extract ONLY what is visibly printed. If a field is not visible, use null. Never guess.
Return one JSON object with exactly these keys:
{
 "document_type": one of "fssai_licence","fssai_registration","ngo_registration","trust_deed","society_registration",
                  "section_8","12a_80g","ngo_darpan","gst","id_proof","other",
 "organisation_name": string|null,
 "registration_number": string|null,
 "issuing_authority": string|null,
 "address": string|null,
 "issue_date": "YYYY-MM-DD"|null,
 "expiry_date": "YYYY-MM-DD"|null,
 "category_or_business": string|null,
 "signatory": string|null,
 "legible": true|false,
 "red_flags": [short strings, e.g. "edited text", "cropped", "photo of a screen"],
 "notes": short string
}"""

DOC_TYPES_FOR = {
    "donor": {"fssai_licence", "fssai_registration", "gst", "trust_deed", "society_registration", "section_8", "id_proof"},
    "ngo": {"ngo_registration", "trust_deed", "society_registration", "section_8", "12a_80g", "ngo_darpan", "id_proof",
            "fssai_licence", "fssai_registration"},
}


def _norm(s: str | None) -> str:
    s = (s or "").lower()
    s = re.sub(r"\b(pvt|private|ltd|limited|llp|the|and|&|foundation|trust|society|ngo)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def similarity(a: str | None, b: str | None) -> float:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def _date(v: str | None) -> date | None:
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(v.strip(), fmt).date()
        except ValueError:
            continue
    return None


def run_checks(ex: dict, org: dict, other_numbers: list[dict], today: date | None = None) -> list[dict]:
    """Returns a checklist of {check, result: pass|warn|fail, detail}."""
    today = today or date.today()
    out: list[dict] = []

    def add(check: str, result: str, detail: str) -> None:
        out.append({"check": check, "result": result, "detail": detail})

    dtype = ex.get("document_type") or "other"
    num = re.sub(r"\s+", "", str(ex.get("registration_number") or ""))

    # 1. legibility / red flags
    if ex.get("legible") is False:
        add("Legibility", "fail", "The document could not be read clearly.")
    else:
        add("Legibility", "pass", "Readable.")
    flags = [f for f in (ex.get("red_flags") or []) if isinstance(f, str) and f.strip()]
    if flags:
        add("Visual red flags", "warn", "; ".join(flags[:5]))

    # 2. name matches profile
    sim = similarity(ex.get("organisation_name"), org.get("name"))
    if not ex.get("organisation_name"):
        add("Name matches profile", "warn", "No organisation name found on the document.")
    elif sim >= 0.8:
        add("Name matches profile", "pass", f'"{ex["organisation_name"]}" matches "{org.get("name")}".')
    elif sim >= 0.55:
        add("Name matches profile", "warn", f'"{ex["organisation_name"]}" is similar to "{org.get("name")}" ({sim:.0%}).')
    else:
        add("Name matches profile", "fail", f'"{ex["organisation_name"]}" does not match "{org.get("name")}".')

    # 3. address
    if ex.get("address") and org.get("address"):
        asim = similarity(ex["address"], org["address"])
        add("Address matches profile", "pass" if asim >= 0.6 else "warn",
            f"Address similarity {asim:.0%}.")

    # 4. number format
    if dtype in ("fssai_licence", "fssai_registration"):
        if re.fullmatch(r"\d{14}", num):
            add("FSSAI number format", "pass", f"{num} has 14 digits.")
        else:
            add("FSSAI number format", "fail", f'"{num or "missing"}" is not a 14-digit FSSAI number.')
    elif num:
        add("Registration number", "pass", f"Found {num}.")
    else:
        add("Registration number", "warn", "No registration number found.")

    # 5. dates
    exp, iss = _date(ex.get("expiry_date")), _date(ex.get("issue_date"))
    if iss and iss > today:
        add("Issue date", "fail", f"Issue date {iss} is in the future.")
    if exp:
        if exp < today:
            add("Expiry", "fail", f"Expired on {exp}.")
        elif (exp - today).days < 30:
            add("Expiry", "warn", f"Expires soon ({exp}).")
        else:
            add("Expiry", "pass", f"Valid until {exp}.")
    elif dtype in ("fssai_licence", "fssai_registration"):
        add("Expiry", "warn", "No expiry date found on an FSSAI document.")

    # 6. document type suits organisation type
    kind = org.get("kind") or "ngo"
    if dtype == "other":
        add("Document type", "warn", "Document type not recognised.")
    elif dtype in DOC_TYPES_FOR.get(kind, set()):
        add("Document type", "pass", f"{dtype.replace('_', ' ')} is expected for a {'donor' if kind == 'donor' else 'receiver'}.")
    else:
        add("Document type", "warn", f"{dtype.replace('_', ' ')} is unusual for a {'donor' if kind == 'donor' else 'receiver'}.")

    # 7. duplicates across organisations
    if num:
        dup = [o for o in other_numbers if re.sub(r"\s+", "", str(o.get("number") or "")) == num
               and o.get("org_id") != org.get("id")]
        if dup:
            add("Duplicate number", "fail", f"The same number is on {len(dup)} other organisation(s).")
        else:
            add("Duplicate number", "pass", "Not used by any other organisation.")
    return out


def score(checks: list[dict]) -> tuple[int, str]:
    if not checks:
        return 0, "needs_review"
    pts = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
    conf = round(100 * sum(pts[c["result"]] for c in checks) / len(checks))
    fails = sum(c["result"] == "fail" for c in checks)
    if fails >= 2 or conf < 45:
        return conf, "likely_invalid"
    flagged = any(c["check"] == "Visual red flags" for c in checks)
    if fails == 1 or conf < 80 or flagged:
        return min(conf, 79) if flagged else conf, "needs_review"
    return conf, "looks_valid"


REC_LABEL = {"looks_valid": "Looks valid", "needs_review": "Needs a closer look", "likely_invalid": "Likely invalid"}


def summarise(ex: dict, org: dict, checks: list[dict], conf: int, rec: str) -> str:
    """Short plain-English summary, built without the AI so it never invents facts."""
    dtype = (ex.get("document_type") or "document").replace("_", " ")
    parts = [f"{dtype.capitalize()} for {ex.get('organisation_name') or 'an unnamed organisation'}"
             + (f", number {ex['registration_number']}" if ex.get("registration_number") else "") + "."]
    if ex.get("expiry_date"):
        parts.append(f"Valid until {ex['expiry_date']}.")
    bad = [c for c in checks if c["result"] == "fail"]
    warn = [c for c in checks if c["result"] == "warn"]
    if bad:
        parts.append("Problems: " + "; ".join(c["detail"] for c in bad[:3]))
    if warn:
        parts.append("Check: " + "; ".join(c["detail"] for c in warn[:3]))
    if not bad and not warn:
        parts.append("All automatic checks passed.")
    parts.append(f"Recommendation: {REC_LABEL[rec]} (confidence {conf}/100). The admin makes the final decision.")
    return " ".join(parts)


NO_CERT_PROMPT = """An organisation without a registration certificate asked a food-donation platform for manual verification.
Organisation profile and explanation are below. Summarise for the admin in JSON:
{"summary": 2-4 plain sentences (who they are, who they serve, since when, references),
 "claims": [short factual claims they make],
 "to_verify": [specific things the admin should check manually, e.g. call the ward office],
 "concerns": [anything vague, inconsistent or risky; empty list if none],
 "confidence": 0-100 how well-supported the request is}
Do not invent facts that are not in the text.

PROFILE:
"""
