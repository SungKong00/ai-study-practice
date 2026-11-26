"""Run against a disposable schema in the local practice Postgres."""
import json
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCHEMA = "test_" + uuid.uuid4().hex


def sql(query):
    result = subprocess.run(["docker", "compose", "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1",
                             "-qAt", "-U", "triage", "-d", "triage"], cwd=ROOT,
                            input=f"SET search_path TO {SCHEMA};\n" + query, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def query(workflow, node):
    data = json.loads((ROOT / "exports" / (workflow + ".json")).read_text())
    return next(n["parameters"]["query"] for n in data["nodes"] if n["name"] == node)


def main():
    sql(f"CREATE SCHEMA {SCHEMA}")
    try:
        schema = (ROOT / "schema.sql").read_text()
        sql(schema.split("-- Existing installations")[0])
        sql("""INSERT INTO team_request(request_id, request_text, spec_sha, category, evidence,answer,title,body,state,issue_number)
           SELECT s,'req','sha','새 기능','proof','answer','title','body',s,CASE WHEN s='published' THEN 123 END
           FROM unnest(ARRAY['pending','rejected','publishing','published']) s""")
        sql(schema)
        sql(schema)
        assert sql("SELECT count(*) FROM team_request WHERE state=request_id AND title='title' AND body='body' AND (state!='published' OR issue_number=123)") == "4"

        store = query("evidence", "캐시 저장")
        lookup = query("evidence", "캐시 조회")
        sql(f"PREPARE put(text,text,text) AS {store}; EXECUTE put('test','old','{{}}');")
        result = sql(f"PREPARE get(text,text) AS {lookup}; EXECUTE get('test','old'); EXECUTE get('test','new');")
        assert "scope_digest" in result.splitlines()[0] and result.splitlines()[1]=="test|new|"

        initial = sql("SELECT review_token FROM team_request WHERE state='pending'")
        edit = query("review","재승인 대기")
        # A legacy draft is shown again, retaining its ID but invalidating the original button.
        sql(f"PREPARE edit(text,uuid,text,text,text,text,text,text,text,text,jsonb) AS {edit}; "
            f"EXECUTE edit('pending','{initial}','title','body','새 기능','answer','proof','basis','digest','owner/shop','[]');")
        assert sql("SELECT revision FROM team_request WHERE request_id='pending'") == "2"
        token = sql("SELECT review_token FROM team_request WHERE state='pending'")
        decision = query("review","결정 반영")
        claim = f"PREPARE claim(text,uuid,text,text,text,text) AS {decision}; EXECUTE claim('pending','{token}','title','body','publishing','test');"
        assert token != initial
        assert "publishing" not in sql(claim.replace(token,initial))
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(sql, [claim, claim]))
        assert sum("publishing" in result for result in outcomes) == 1

        # Loss of the GitHub response leaves publishing intact. Replays cannot acquire a second claim.
        assert "publishing" not in sql(claim)
        link = query("review","이슈 연결")
        attach = f"PREPARE attach(text,bigint) AS {link}; EXECUTE attach('pending',7);"
        assert "published" in sql(attach)
        assert "published" in sql(attach)
        assert sql("SELECT issue_number FROM team_request WHERE request_id='pending'") == "7"

        ticket = sql("SELECT ticket FROM team_model_reserve('demo','gpt-5.4-mini',200,100)")
        assert sql(f"SELECT team_model_settle('{ticket}',20,3)")=="t"
        assert sql(f"SELECT team_model_settle('{ticket}',20,3)")=="f"
        sql("SELECT ticket FROM team_model_reserve('demo','gpt-5.4-mini',200,100)")
        sql("SELECT ticket FROM team_model_reserve('demo','gpt-5.4-mini',200,100)")
        for call in ["SELECT ticket FROM team_model_reserve('demo','gpt-5.4-mini',200,100)",
                     "SELECT ticket FROM team_model_reserve('other','gpt-5.4',200000000,100)"]:
            try:
                sql(call)
            except RuntimeError as error:
                assert '한도' in str(error)
            else:
                raise AssertionError("예산 또는 턴 한도 검사 실패")
        sql("UPDATE team_model_month SET allocated=80; UPDATE team_model_run SET created_at=now()-interval '31 days'")
        assert sql("SELECT warning FROM team_model_reserve('after-retention','gpt-5.4-mini',200,100)")=="t"
        assert sql("SELECT count(*) FROM team_model_run WHERE turn_id='demo'")=="0"
        print("migration, cache, concurrent approval, metering: OK")
    finally:
        sql(f"DROP SCHEMA {SCHEMA} CASCADE")


if __name__ == "__main__":
    main()
