"""
FocusMatch — Test Database Generator
=====================================
Generates realistic SQLite test databases that mirror the full PostgreSQL schema
defined in focusmatch-project-documentation.md §10 and the frontend types in
src/types/index.ts.

College : KIIT (Kalinga Institute of Industrial Technology)
City    : BBSR (Bhubaneswar)
Domain  : kiit.ac.in

Usage
-----
    python scripts/generate_test_db.py                   # generates db/test_focusmatch.db
    python scripts/generate_test_db.py --out custom.db   # custom output path
    python scripts/generate_test_db.py --users 20        # more users (default: 10)
    python scripts/generate_test_db.py --seed 42         # reproducible run

Output
------
  db/test_focusmatch.db   — main relational test database
  db/test_queue.json      — simulated Redis matchmaking-queue state (JSON)
  db/test_summary.txt     — human-readable summary of what was generated
"""

import argparse
import hashlib
import json
import os
import random
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COLLEGE_NAME = "Kalinga Institute of Industrial Technology (KIIT)"
COLLEGE_CITY = "Bhubaneswar (BBSR)"
COLLEGE_DOMAIN = "kiit.ac.in"

# Anonymous username word pools (matches src/data/mockData.ts style)
ADJECTIVES = [
    "Quiet", "Silent", "Deep", "Calm", "Midnight", "Steady", "Serene",
    "Swift", "Bright", "Bold", "Sharp", "Keen", "Dark", "Cool", "Wise",
    "Lone", "Crisp", "Clear", "Frost", "Storm",
]
ANIMALS = [
    "Falcon", "Lynx", "Bear", "Owl", "Panda", "Hawk", "Otter", "Wolf",
    "Fox", "Eagle", "Tiger", "Raven", "Crane", "Bison", "Seal",
    "Lynx", "Moose", "Ibis", "Finch", "Drake",
]

# Pomodoro durations (minutes)
DURATIONS = [25, 50]

# Sample task descriptions
TASK_TEMPLATES = [
    "Revise Ch {n} notes",
    "Solve {n} problems from assignment",
    "Read {n} pages of textbook",
    "Complete lab report for experiment {n}",
    "Summarise lecture {n}",
    "Watch and note tutorial {n}",
    "Practice {n} past-year questions",
    "Review flashcards for topic {n}",
    "Draft essay outline (section {n})",
    "Debug and submit project module {n}",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def new_uuid() -> str:
    return str(uuid.uuid4())


def email_for(roll: int) -> str:
    return f"{roll:07d}@{COLLEGE_DOMAIN}"


def hash_email(email: str) -> str:
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()


def anon_username(rng: random.Random) -> str:
    adj = rng.choice(ADJECTIVES)
    animal = rng.choice(ANIMALS)
    num = rng.randint(100, 999)
    return f"{adj}{animal}{num}"


def avatar_seed(user_id: str) -> str:
    """Deterministic seed derived from user id (mirrors identicon.ts logic)."""
    return hashlib.md5(user_id.encode()).hexdigest()[:12]


def score(focus_mins: int, tasks: int, sessions: int) -> float:
    """Scoring formula from §13 / src/utils/scoring.ts."""
    return round((0.5 * focus_mins) + (30 * tasks) + (10 * sessions), 1)


# ---------------------------------------------------------------------------
# Schema creation
# ---------------------------------------------------------------------------

DDL = """
PRAGMA foreign_keys = ON;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    college_email_hash  TEXT NOT NULL UNIQUE,
    is_verified         INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
    created_at          TEXT NOT NULL,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    total_matches       INTEGER NOT NULL DEFAULT 0,
    total_wins          INTEGER NOT NULL DEFAULT 0,
    total_losses        INTEGER NOT NULL DEFAULT 0,
    total_draws         INTEGER NOT NULL DEFAULT 0,

    -- KIITDual extras (not in base SRS, useful for dev)
    college_name        TEXT NOT NULL DEFAULT '',
    college_city        TEXT NOT NULL DEFAULT '',
    roll_number         TEXT NOT NULL DEFAULT ''
);

-- ── anon_profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anon_profiles (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anon_username    TEXT NOT NULL UNIQUE,
    avatar_seed      TEXT NOT NULL,
    rotates_per_match INTEGER NOT NULL DEFAULT 0    -- false → persistent per account
);

-- ── matches ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
    id          TEXT PRIMARY KEY,
    user1_id    TEXT NOT NULL REFERENCES users(id),
    user2_id    TEXT NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL CHECK(status IN ('queued','active','completed','forfeited')),
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    winner_id   TEXT REFERENCES users(id)
);

-- ── match_tasks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_tasks (
    id           TEXT PRIMARY KEY,
    match_id     TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id),
    description  TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    completed_at TEXT
);

-- ── focus_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
    id               TEXT PRIMARY KEY,
    match_id         TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id          TEXT NOT NULL REFERENCES users(id),
    started_at       TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    completed        INTEGER NOT NULL DEFAULT 0
);

-- ── match_results ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results (
    id                  TEXT PRIMARY KEY,
    match_id            TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id             TEXT NOT NULL REFERENCES users(id),
    total_focus_minutes INTEGER NOT NULL DEFAULT 0,
    tasks_completed     INTEGER NOT NULL DEFAULT 0,
    sessions_completed  INTEGER NOT NULL DEFAULT 0,
    final_score         REAL    NOT NULL DEFAULT 0
);

-- ── otp_codes (auth simulation) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
    id         TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    code       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
);

-- ── Useful indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_user1   ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2   ON matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status);
CREATE INDEX IF NOT EXISTS idx_tasks_match     ON match_tasks(match_id);
CREATE INDEX IF NOT EXISTS idx_sessions_match  ON focus_sessions(match_id);
CREATE INDEX IF NOT EXISTS idx_results_match   ON match_results(match_id);
"""


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(DDL)
    conn.commit()


# ---------------------------------------------------------------------------
# Data generators
# ---------------------------------------------------------------------------

def gen_users(rng: random.Random, n: int, base_time: datetime) -> list[dict]:
    users = []
    used_usernames: set[str] = set()
    roll_start = 22052001

    for i in range(n):
        uid = new_uuid()
        roll = roll_start + i
        email = email_for(roll)
        username = anon_username(rng)
        # ensure uniqueness
        while username in used_usernames:
            username = anon_username(rng)
        used_usernames.add(username)

        created = base_time - timedelta(days=rng.randint(1, 180))

        users.append({
            "id": uid,
            "college_email_hash": hash_email(email),
            "is_verified": 1,
            "created_at": iso(created),
            "current_streak": 0,          # computed after matches are inserted
            "total_matches": 0,
            "total_wins": 0,
            "total_losses": 0,
            "total_draws": 0,
            "college_name": COLLEGE_NAME,
            "college_city": COLLEGE_CITY,
            "roll_number": str(roll),
            # local extras not stored in DB but used during generation
            "_email": email,
            "_anon_username": username,
            "_avatar_seed": avatar_seed(uid),
        })

    return users


def gen_anon_profiles(users: list[dict]) -> list[dict]:
    profiles = []
    for u in users:
        profiles.append({
            "id": new_uuid(),
            "user_id": u["id"],
            "anon_username": u["_anon_username"],
            "avatar_seed": u["_avatar_seed"],
            "rotates_per_match": 0,
        })
    return profiles


def gen_matches_and_results(
    rng: random.Random,
    users: list[dict],
    base_time: datetime,
) -> tuple[list, list, list, list]:
    """
    Generate a realistic set of completed + active + queued matches.
    Returns (matches, tasks, sessions, results).
    """
    matches, tasks, sessions, results = [], [], [], []

    user_ids = [u["id"] for u in users]
    stats: dict[str, dict] = {u["id"]: {"wins": 0, "losses": 0, "draws": 0, "streak_days": []} for u in users}

    # -- Completed matches: pair every user with 2-5 past opponents --------
    paired: set[frozenset] = set()

    for u in users:
        n_past = rng.randint(2, 5)
        opponents = [o for o in users if o["id"] != u["id"]]
        rng.shuffle(opponents)

        for opp in opponents[:n_past]:
            pair = frozenset([u["id"], opp["id"]])
            if pair in paired:
                continue
            paired.add(pair)

            # Match timing: anywhere from 1–90 days ago
            days_ago = rng.randint(1, 90)
            start = base_time - timedelta(days=days_ago, hours=rng.randint(0, 23))
            end = start + timedelta(hours=24)
            match_id = new_uuid()

            m = {
                "id": match_id,
                "user1_id": u["id"],
                "user2_id": opp["id"],
                "status": "completed",
                "start_time": iso(start),
                "end_time": iso(end),
                "winner_id": None,  # set below
            }

            # Generate per-participant data
            def gen_participant_data(uid: str, match_start: datetime) -> dict:
                n_sessions = rng.randint(1, 8)
                n_tasks_total = rng.randint(2, 6)
                n_tasks_done = rng.randint(0, n_tasks_total)

                sess_list = []
                t = match_start + timedelta(minutes=rng.randint(5, 30))
                for _ in range(n_sessions):
                    dur = rng.choice(DURATIONS)
                    completed_flag = 1 if rng.random() > 0.15 else 0
                    sess_list.append({
                        "id": new_uuid(),
                        "match_id": match_id,
                        "user_id": uid,
                        "started_at": iso(t),
                        "duration_minutes": dur,
                        "completed": completed_flag,
                    })
                    t += timedelta(minutes=dur + rng.randint(5, 20))

                task_list = []
                for k in range(n_tasks_total):
                    tmpl = rng.choice(TASK_TEMPLATES)
                    desc = tmpl.format(n=rng.randint(1, 12))
                    done = k < n_tasks_done
                    task_list.append({
                        "id": new_uuid(),
                        "match_id": match_id,
                        "user_id": uid,
                        "description": desc,
                        "is_completed": int(done),
                        "created_at": iso(match_start + timedelta(minutes=rng.randint(1, 15))),
                        "completed_at": iso(match_start + timedelta(hours=rng.randint(1, 22))) if done else None,
                    })

                completed_sessions = [s for s in sess_list if s["completed"]]
                focus_mins = sum(s["duration_minutes"] for s in completed_sessions)
                final = score(focus_mins, n_tasks_done, len(completed_sessions))

                return {
                    "sessions": sess_list,
                    "tasks": task_list,
                    "focus_mins": focus_mins,
                    "tasks_done": n_tasks_done,
                    "sessions_done": len(completed_sessions),
                    "final_score": final,
                }

            d1 = gen_participant_data(u["id"], start)
            d2 = gen_participant_data(opp["id"], start)

            # Determine winner
            if d1["final_score"] > d2["final_score"]:
                m["winner_id"] = u["id"]
                stats[u["id"]]["wins"] += 1
                stats[opp["id"]]["losses"] += 1
            elif d2["final_score"] > d1["final_score"]:
                m["winner_id"] = opp["id"]
                stats[opp["id"]]["wins"] += 1
                stats[u["id"]]["losses"] += 1
            else:
                m["winner_id"] = None  # draw
                stats[u["id"]]["draws"] += 1
                stats[opp["id"]]["draws"] += 1

            matches.append(m)
            sessions.extend(d1["sessions"] + d2["sessions"])
            tasks.extend(d1["tasks"] + d2["tasks"])

            # match_results rows
            for uid, d in [(u["id"], d1), (opp["id"], d2)]:
                results.append({
                    "id": new_uuid(),
                    "match_id": match_id,
                    "user_id": uid,
                    "total_focus_minutes": d["focus_mins"],
                    "tasks_completed": d["tasks_done"],
                    "sessions_completed": d["sessions_done"],
                    "final_score": d["final_score"],
                })

    # -- One active match (first two users) --------------------------------
    if len(users) >= 2:
        u1, u2 = users[0], users[1]
        start = base_time - timedelta(hours=rng.randint(1, 20))
        end = start + timedelta(hours=24)
        match_id = new_uuid()
        matches.append({
            "id": match_id,
            "user1_id": u1["id"],
            "user2_id": u2["id"],
            "status": "active",
            "start_time": iso(start),
            "end_time": iso(end),
            "winner_id": None,
        })
        # partial sessions and tasks for active match
        for uid in [u1["id"], u2["id"]]:
            for _ in range(rng.randint(1, 3)):
                sessions.append({
                    "id": new_uuid(),
                    "match_id": match_id,
                    "user_id": uid,
                    "started_at": iso(start + timedelta(minutes=rng.randint(5, 60))),
                    "duration_minutes": rng.choice(DURATIONS),
                    "completed": 1,
                })
            for k in range(rng.randint(2, 4)):
                tasks.append({
                    "id": new_uuid(),
                    "match_id": match_id,
                    "user_id": uid,
                    "description": rng.choice(TASK_TEMPLATES).format(n=rng.randint(1, 10)),
                    "is_completed": int(k == 0),
                    "created_at": iso(start + timedelta(minutes=5)),
                    "completed_at": iso(start + timedelta(hours=1)) if k == 0 else None,
                })

    # -- One queued match (users[2] waiting) --------------------------------
    if len(users) >= 3:
        u3 = users[2]
        start = base_time + timedelta(seconds=30)  # not started yet
        end = start + timedelta(hours=24)
        matches.append({
            "id": new_uuid(),
            "user1_id": u3["id"],
            "user2_id": u3["id"],    # placeholder; will be replaced by matchmaker
            "status": "queued",
            "start_time": iso(start),
            "end_time": iso(end),
            "winner_id": None,
        })

    # -- Update user stats from computed stats dict -------------------------
    for u in users:
        uid = u["id"]
        u["total_wins"] = stats[uid]["wins"]
        u["total_losses"] = stats[uid]["losses"]
        u["total_draws"] = stats[uid]["draws"]
        u["total_matches"] = stats[uid]["wins"] + stats[uid]["losses"] + stats[uid]["draws"]
        # Simplified streak: consecutive wins
        u["current_streak"] = stats[uid]["wins"]

    return matches, tasks, sessions, results


def gen_otp_codes(users: list[dict], base_time: datetime) -> list[dict]:
    """Generate a few sample (already-used) OTP codes for testing the auth flow."""
    codes = []
    for u in users[:3]:
        codes.append({
            "id": new_uuid(),
            "email_hash": u["college_email_hash"],
            "code": str(random.randint(100000, 999999)),
            "created_at": iso(base_time - timedelta(minutes=5)),
            "expires_at": iso(base_time + timedelta(minutes=10)),
            "used": 1,
        })
    return codes


# ---------------------------------------------------------------------------
# Database insertion
# ---------------------------------------------------------------------------

def insert_all(conn: sqlite3.Connection, users, profiles, matches, tasks, sessions, results, otps):
    cur = conn.cursor()

    # users
    cur.executemany(
        """INSERT INTO users
           (id, college_email_hash, is_verified, created_at, current_streak,
            total_matches, total_wins, total_losses, total_draws,
            college_name, college_city, roll_number)
           VALUES (:id,:college_email_hash,:is_verified,:created_at,:current_streak,
                   :total_matches,:total_wins,:total_losses,:total_draws,
                   :college_name,:college_city,:roll_number)""",
        [{k: v for k, v in u.items() if not k.startswith("_")} for u in users],
    )

    # anon_profiles
    cur.executemany(
        """INSERT INTO anon_profiles (id, user_id, anon_username, avatar_seed, rotates_per_match)
           VALUES (:id,:user_id,:anon_username,:avatar_seed,:rotates_per_match)""",
        profiles,
    )

    # matches
    cur.executemany(
        """INSERT INTO matches (id, user1_id, user2_id, status, start_time, end_time, winner_id)
           VALUES (:id,:user1_id,:user2_id,:status,:start_time,:end_time,:winner_id)""",
        matches,
    )

    # match_tasks
    cur.executemany(
        """INSERT INTO match_tasks (id, match_id, user_id, description, is_completed, created_at, completed_at)
           VALUES (:id,:match_id,:user_id,:description,:is_completed,:created_at,:completed_at)""",
        tasks,
    )

    # focus_sessions
    cur.executemany(
        """INSERT INTO focus_sessions (id, match_id, user_id, started_at, duration_minutes, completed)
           VALUES (:id,:match_id,:user_id,:started_at,:duration_minutes,:completed)""",
        sessions,
    )

    # match_results
    cur.executemany(
        """INSERT INTO match_results (id, match_id, user_id, total_focus_minutes, tasks_completed, sessions_completed, final_score)
           VALUES (:id,:match_id,:user_id,:total_focus_minutes,:tasks_completed,:sessions_completed,:final_score)""",
        results,
    )

    # otp_codes
    cur.executemany(
        """INSERT INTO otp_codes (id, email_hash, code, created_at, expires_at, used)
           VALUES (:id,:email_hash,:code,:created_at,:expires_at,:used)""",
        otps,
    )

    conn.commit()


# ---------------------------------------------------------------------------
# Redis queue simulation (JSON file)
# ---------------------------------------------------------------------------

def gen_queue_json(users: list[dict], base_time: datetime) -> dict:
    """Simulate a Redis matchmaking queue dump."""
    queue_users = users[2:4] if len(users) >= 4 else users[:1]
    return {
        "description": "Simulated Redis matchmaking queue state",
        "college": COLLEGE_NAME,
        "city": COLLEGE_CITY,
        "generated_at": iso(base_time),
        "queue": [
            {
                "userId": u["id"],
                "anonUsername": u["_anon_username"],
                "queuedAt": iso(base_time - timedelta(seconds=random.randint(10, 120))),
            }
            for u in queue_users
        ],
    }


# ---------------------------------------------------------------------------
# Summary report
# ---------------------------------------------------------------------------

def write_summary(path: str, users, profiles, matches, tasks, sessions, results, base_time: datetime):
    completed = [m for m in matches if m["status"] == "completed"]
    active    = [m for m in matches if m["status"] == "active"]
    queued    = [m for m in matches if m["status"] == "queued"]

    lines = [
        "=" * 60,
        "FocusMatch — Test Database Summary",
        "=" * 60,
        f"College     : {COLLEGE_NAME}",
        f"City        : {COLLEGE_CITY}",
        f"Generated   : {iso(base_time)}",
        "",
        "--- Counts ---",
        f"Users            : {len(users)}",
        f"Anon Profiles    : {len(profiles)}",
        f"Matches (total)  : {len(matches)}",
        f"  Completed      : {len(completed)}",
        f"  Active         : {len(active)}",
        f"  Queued         : {len(queued)}",
        f"Match Tasks      : {len(tasks)}",
        f"Focus Sessions   : {len(sessions)}",
        f"Match Results    : {len(results)}",
        "",
        "--- Users ---",
        f"{'Roll':<12} {'Anon Username':<22} {'W':>4} {'L':>4} {'D':>4} {'Streak':>7}",
        "-" * 55,
    ]
    for u, p in zip(users, profiles):
        lines.append(
            f"{u['roll_number']:<12} {p['anon_username']:<22} "
            f"{u['total_wins']:>4} {u['total_losses']:>4} {u['total_draws']:>4} "
            f"{u['current_streak']:>7}"
        )
    lines += [
        "",
        "--- Active Match ---",
    ]
    if active:
        m = active[0]
        u1 = next(u for u in users if u["id"] == m["user1_id"])
        u2 = next(u for u in users if u["id"] == m["user2_id"])
        lines.append(f"  {u1['roll_number']} vs {u2['roll_number']}")
        lines.append(f"  Started : {m['start_time']}")
        lines.append(f"  Ends    : {m['end_time']}")
    else:
        lines.append("  (none)")
    lines += ["", "--- Score Formula ---",
              "  final_score = (0.5 × focus_min) + (30 × tasks_done) + (10 × sessions_done)",
              "=" * 60]

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate FocusMatch test databases.")
    parser.add_argument("--out",   default="db/test_focusmatch.db", help="SQLite output path")
    parser.add_argument("--users", type=int, default=10,            help="Number of test users")
    parser.add_argument("--seed",  type=int, default=7,             help="Random seed")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    base_time = now_utc()

    # Ensure output directory exists
    db_dir = os.path.dirname(args.out) or "."
    os.makedirs(db_dir, exist_ok=True)

    db_path      = args.out
    queue_path   = os.path.join(db_dir, "test_queue.json")
    summary_path = os.path.join(db_dir, "test_summary.txt")

    print(f"[1/5] Generating data for {args.users} KIIT students in BBSR...")
    users    = gen_users(rng, args.users, base_time)
    profiles = gen_anon_profiles(users)

    print("[2/5] Generating matches, tasks, sessions, results...")
    matches, tasks, sessions, results = gen_matches_and_results(rng, users, base_time)

    otps = gen_otp_codes(users, base_time)

    print(f"[3/5] Writing SQLite DB -> {db_path}")
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    create_schema(conn)
    insert_all(conn, users, profiles, matches, tasks, sessions, results, otps)
    conn.close()

    print(f"[4/5] Writing queue simulation -> {queue_path}")
    with open(queue_path, "w", encoding="utf-8") as f:
        json.dump(gen_queue_json(users, base_time), f, indent=2)

    print(f"[5/5] Writing summary -> {summary_path}")
    write_summary(summary_path, users, profiles, matches, tasks, sessions, results, base_time)

    # Quick verification
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    print("\n[OK] Verification:")
    for table in ["users", "anon_profiles", "matches", "match_tasks", "focus_sessions", "match_results", "otp_codes"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"   {table:<20} : {count:>4} rows")
    cur.execute("SELECT status, COUNT(*) FROM matches GROUP BY status")
    print("\n   Match statuses:")
    for row in cur.fetchall():
        print(f"     {row[0]:<12} : {row[1]}")
    conn.close()

    print(f"\n  College : {COLLEGE_NAME}")
    print(f"  City    : {COLLEGE_CITY}")
    print(f"\nFiles generated:")
    print(f"  {db_path}")
    print(f"  {queue_path}")
    print(f"  {summary_path}")


if __name__ == "__main__":
    main()
