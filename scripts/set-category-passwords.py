#!/usr/bin/env python3
"""
Sets one shared password per user category through the GoTrue admin API.

Categories, matching the distribution sheet (i2i_clubs_dummy_logins.csv):

  owner    the platform owner account, always separate
  giz      GIZ Administration — super_admin + admin
  panel    National Evaluation Panel — expert + expert_admin
  mentor   Industry Mentorship
  teacher  School teachers (and the Lead Teacher persona)
  student  Student enterprise clubs (and the Student Lead persona)

Passwords are never stored in this file. Supply them in the environment:

  NEXT_PUBLIC_SUPABASE_URL=https://...
  SUPABASE_SERVICE_ROLE_KEY=...
  PASSWORD_OWNER=... PASSWORD_GIZ=... PASSWORD_PANEL=...
  PASSWORD_MENTOR=... PASSWORD_TEACHER=... PASSWORD_STUDENT=...
  APPLY=1 python3 scripts/set-category-passwords.py

Without APPLY=1 it reports what it would change and touches nothing.
Role comes from user metadata; accounts that predate the metadata fall back to
login-name patterns, including the four legacy harithapasal.lk personas.
"""

import json
import os
import sys
import urllib.error
import urllib.request

OWNER_EMAIL = "asanga.cdn@gmail.com"
MIN_LENGTH = 8

CATEGORIES = ["owner", "giz", "panel", "mentor", "teacher", "student"]


def password_for(category):
    return os.environ.get("PASSWORD_" + category.upper(), "")


def categorise(email, role):
    email = (email or "").lower()
    role = (role or "").lower()

    if email == OWNER_EMAIL:
        return "owner"
    if role in ("super_admin", "admin", "expert", "expert_admin", "mentor", "teacher", "student"):
        return {"super_admin": "giz", "admin": "giz",
                "expert": "panel", "expert_admin": "panel"}.get(role, role)
    # No usable metadata: infer from the login name.
    if email.endswith(".teacher@") or email.startswith("teacher.royal@"):
        return "teacher"
    if email.startswith("auditor.giz@"):
        return "giz"
    if email.endswith(".club@") or email.startswith("student.lead@"):
        return "student"
    if email.startswith("expert."):
        return "panel"
    return None


def request(method, url, key, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else None


def list_users(base, key):
    users, page = [], 1
    while True:
        data = request("GET", f"{base}/auth/v1/admin/users?page={page}&per_page=200", key)
        batch = data.get("users", [])
        users.extend(batch)
        if len(batch) < 200:
            return users
        page += 1


def main():
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    apply = os.environ.get("APPLY") == "1"

    if not base or not key:
        sys.exit("SUPABASE URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    missing = [c for c in CATEGORIES if len(password_for(c)) < MIN_LENGTH]
    if missing:
        sys.exit("Missing or too-short password for: " + ", ".join(missing))

    users = list_users(base, key)
    print(f"{'Applying' if apply else 'Dry run'} on {len(users)} accounts at {base}\n")

    tally = {c: 0 for c in CATEGORIES}
    unmatched, failures = [], []

    for user in users:
        email = (user.get("email") or "").lower()
        if not email:
            continue
        category = categorise(email, (user.get("user_metadata") or {}).get("role"))
        if category is None:
            unmatched.append(email)
            continue
        tally[category] += 1

        if not apply:
            continue

        try:
            request("PUT", f"{base}/auth/v1/admin/users/{user['id']}", key,
                    {"password": password_for(category)})
        except urllib.error.HTTPError as error:
            failures.append(f"{email} — {error.code} {error.read().decode()[:120]}")

    for category in CATEGORIES:
        print(f"  {category:8} {tally[category]}")

    if unmatched:
        print(f"\n  unmatched {len(unmatched)} (left untouched)")
        if os.environ.get("VERBOSE") == "1":
            for email in unmatched:
                print(f"    {email}")

    if failures:
        print(f"\n{len(failures)} failed:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)

    print("\nDone." if apply else "\nDry run only. Re-run with APPLY=1 to write.")


if __name__ == "__main__":
    main()
