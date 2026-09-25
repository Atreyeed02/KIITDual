import sqlite3, os, json

def main():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'test_focusmatch.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    schema = {name: sql for name, sql in tables}
    print(json.dumps(schema, indent=2))

if __name__ == "__main__":
    main()
