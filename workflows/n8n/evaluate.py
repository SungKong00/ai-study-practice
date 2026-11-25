"""Submit test cases to the intake form and score the returned classifications."""
import argparse
import html
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4


def fetch(url, data=None, headers=None):
    with urlopen(Request(url, data=data, headers=headers or {}), timeout=15) as response:
        return response.read().decode()


def receipt(url, request_id, text):
    boundary = uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="field-{i}"\r\n\r\n{value}\r\n'
             for i, value in enumerate((request_id, text))]
    body = ("".join(parts) + f"--{boundary}--\r\n").encode()
    response = json.loads(fetch(url, body, {"Content-Type": "multipart/form-data; boundary=" + boundary}))
    if not isinstance(response, dict) or not isinstance(response.get("formWaitingUrl"), str):
        raise ValueError("접수 폼 응답에 결과 주소가 없습니다.")
    waiting = response["formWaitingUrl"]
    target = urlsplit(waiting)
    if (target.scheme, target.netloc) != (urlsplit(url).scheme, urlsplit(url).netloc):
        raise ValueError("폼 URL과 n8n WEBHOOK_URL의 주소가 다릅니다.")
    status_url = target._replace(path=target.path + "/n8n-execution-status").geturl()
    deadline = time.monotonic() + 100
    while time.monotonic() < deadline:
        state = fetch(status_url).strip()
        if state == "form-waiting":
            break
        if state in ("error", "crashed", "canceled", "success", "null"):
            raise RuntimeError("n8n 실행 상태 " + state)
        time.sleep(0.5)
    else:
        raise TimeoutError("n8n 실행 기록에서 분류 단계를 확인하세요.")
    page = fetch(waiting)
    match = re.search(r"<pre>(.*?)</pre>", page, re.DOTALL)
    if not match:
        raise ValueError("접수 완료 화면을 확인하세요.")
    result = html.unescape(match[1])
    lines = result.splitlines()
    if len(lines) < 2 or lines[0] != request_id:
        raise ValueError("접수 ID 또는 분류를 확인하세요.")
    _, separator, tail = result.rpartition("\n명세 근거: ")
    quote, status, _ = tail.rpartition("\n상태: ")
    if not separator or not status or not quote:
        raise ValueError("접수 완료 화면에서 명세 근거 또는 상태를 찾지 못했습니다.")
    fetch(waiting, b"")  # Finish the intake execution, as the completion page does.
    return lines[1], quote


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:5678/form/team-request")
    parser.add_argument("--set", choices=["practice", "holdout"], default="practice")
    parser.add_argument("--cases", type=Path, default=Path(__file__).with_name("eval-cases.json"))
    args = parser.parse_args()
    passed = total = 0
    for case in json.loads(args.cases.read_text()):
        if case["set"] != args.set:
            continue
        request_id = "eval-" + uuid4().hex
        try:
            actual, quote = receipt(args.url, request_id, case["request"])
        except (OSError, ValueError, RuntimeError) as error:
            raise SystemExit(f"{request_id} | {case['request']} | 접수 결과 확인 실패 ({error})\n"
                             f"중단 전 평가 완료 {total}건, 통과 {passed}건") from None
        ok = actual == case["expected"] and any(x in quote for x in case["evidenceAny"])
        total += 1
        passed += int(ok)
        print(f"{request_id} | {case['request']} | 기대 {case['expected']} | 실제 {actual} | 근거 {quote} | {'통과' if ok else '검토'}")
    print(f"{passed}/{total}")
    raise SystemExit(0 if total and passed == total else 1)
