# 팀 요청 접수 실습

팀원이 요청을 제출하면 AI가 상품 명세를 읽고 답한다. 새 기능은 담당자의 대기 목록에 들어간다. 담당자가 실제 제목과 본문을 확인하고 승인하면 GitHub 이슈 한 건이 생긴다.

## 처음 실행하기

Docker Compose와 Python 3를 사용한다. 이 디렉터리의 `.env`에 `TRIAGE_DB_PASSWORD=<직접 생성한 비밀번호>`를 저장한다. 로컬 편집기는 루프백 주소로 열리고 접수 기록은 PostgreSQL 볼륨에 남는다.

```sh
cd workflows/n8n
docker compose up -d --wait db
docker compose run --rm --no-deps -T n8n import:workflow --separate --input=/workflows
docker compose up -d n8n
```

[로컬 편집기](http://localhost:5678)에서 첫 소유자 계정을 만들고 아래 연결을 지정한다. 최초 가져오기 이후에는 `docker compose up -d`로 다시 시작한다. 같은 ID의 JSON을 다시 가져오면 편집기에서 수정한 워크플로가 교체된다. n8n Cloud에서는 접근 가능한 PostgreSQL에 [테이블](schema.sql)을 만들고, 편집기의 **Import from File**로 [요청 접수](exports/intake.json)와 [담당자 검토](exports/review.json)를 각각 가져온다. [n8n 가져오기 가이드](https://docs.n8n.io/workflows/export-import/)

| 편집기에서 열 노드 | 연결할 자격 증명 |
|---|---|
| 두 워크플로의 PostgreSQL 노드 | 같은 Postgres 연결. 로컬 호스트는 `db`, 포트는 `5432`, 데이터베이스와 사용자는 `triage`, 비밀번호는 위의 `.env` 값이다. |
| 요청 접수 → AI 분류 | OpenAI 자격 증명. 모델은 `분류 입력`에 지정한다. |
| 담당자 검토 → 담당자 검토 | 검토 담당자에게만 공유할 Basic Auth 사용자 이름과 비밀번호. |
| 담당자 검토 → 승인한 이슈 생성, 기존 이슈 읽기 | 연습할 저장소에만 `Issues: write`가 있는 GitHub 자격 증명. |

기본 대상은 `SungKong00/ai-study-practice`다. `기준 명세`는 GitHub Contents API에서 공개 명세를 읽는다. 팀 포크를 쓰면 이 URL의 저장소·브랜치와 검토 워크플로에 있는 두 GitHub 노드의 저장소를 바꾼다. 비공개 명세는 조회 노드에 `Contents: read` 자격 증명을 연결한다. 두 워크플로를 **Publish**하면 아래 폼이 열린다. [GitHub 파일 조회](https://docs.github.com/en/rest/repos/contents#get-repository-content)

## 한 건 처리하기

1. [요청 폼](http://localhost:5678/form/team-request)에 `study-price-01`과 “등록한 상품의 가격을 바꾸고 싶어요”를 입력한다. 분류·답변·명세 원문을 확인한다. 같은 요청의 재시도에는 같은 ID를 쓴다.
2. [담당자 폼](http://localhost:5678/form/team-review)에 로그인한다. **대기 목록**을 선택하면 오래된 순서로 최대 30건이 보인다. 요청 ID로 **초안 보기**를 열어 이슈 제목·본문·명세 근거를 확인하고 검토 코드를 복사한다.
3. 같은 폼에 ID와 검토 코드를 입력하고 **승인**, **거절**, **수정 후 재검토** 중 하나를 선택한다. 수정할 때 바뀐 제목이나 본문만 입력한다. 수정본을 승인하려면 다시 열어 새 검토 코드를 사용한다.
4. 생성 결과가 불명확하면 GitHub에서 본문의 `<!-- team-request:요청ID -->`와 제목을 확인한다. 폼의 **기존 이슈 연결**에 번호를 넣으면 승인 당시의 제목·본문을 대조한다. 일치하는 이슈를 확인할 때까지 생성 보류 상태를 유지한다. GitHub 생성 노드만 따로 재실행하면 이 중복 방지를 건너뛰므로 복구는 담당자 폼에서 진행한다.

## 평가와 실행 기록

두 명령은 요청 폼에만 제출한다. 매번 새 요청 ID를 사용하므로 케이스마다 모델을 한 번 호출한다. 검토 대기 중인 평가용 초안은 담당자 폼에서 거절할 수 있다.

```sh
python3 evaluate.py --set practice
python3 evaluate.py --set holdout
```

[평가 입력](eval-cases.json)에서 기대 분류와 인용 근거를 먼저 정한다. 오답은 표시하고 다음 요청을 평가한다. 접수 결과를 받을 수 없으면 요청 ID와 완료 건수를 출력하고 멈춘다. n8n **Executions**에서 `입력 확인`의 ID를 대조한 뒤 `기준 명세 → 분류 입력 → AI 분류 → 근거 확인` 순으로 살핀다. 연습용 요청으로 수정한 뒤 아껴 둔 요청으로 평가하고, 사람의 검토·수정 시간까지 비교한다. [n8n 실행 기록](https://docs.n8n.io/workflows/executions/)

## Discord 포럼에서 요청하기

봇은 지정한 포럼의 글과 답글을 OpenAI API로 처리한다. 이미 지원하면 명세·구현의 인용으로 답하고, 조건이 미정이면 같은 글에서 질문한다. 봇은 [로컬과 공유하는 기능 요청 양식](../../.github/ISSUE_TEMPLATE/feature.md)에 합의한 동작과 완료 예시를 채운다. 검토할 새 기능은 이 워크플로의 PostgreSQL 대기열에 저장한다. Discord 담당자와 폼 담당자가 같은 버전을 동시에 승인해도 기존 등록 경로를 사용한다.

1. 기존 설치를 갱신할 때는 편집기에서 변경한 워크플로를 먼저 내보낸다. 새 [담당자 검토](exports/review.json)와 [Discord 연결](exports/discord.json)을 가져온다. Discord 워크플로의 **Discord 연결** Webhook의 Header Auth 이름을 `X-Discord-Bridge`, 값을 임의의 긴 비밀키로 설정한다. **Discord 초안 보관**에도 기존과 같은 PostgreSQL 자격 증명을 연결하고 검토, Discord 연결 순으로 Publish한다. 기존 폼만 쓰는 팀은 Discord 워크플로를 비활성 상태로 둔다.
2. Discord 서버에 상품 요청 포럼과 승인 담당 역할을 만든다. Developer Portal에서 봇의 **Message Content Intent**를 켜고 해당 포럼에 채널 보기, 메시지 기록 읽기, 스레드 메시지 보내기, 링크 임베드 권한을 준다. 기획자는 포럼 글을 만들 수 있어야 한다. [Discord 권한 가이드](https://discord.com/developers/docs/topics/permissions)
3. 저장소 루트에서 아래 명령을 실행한다. 첫 명령으로 복사한 파일에 봇 토큰, 포럼·역할 ID, OpenAI API 키, 같은 Header Auth 값을 채운다. 봇은 호스트에서 실행해 로컬 n8n에 접속한다. 서버에 배치할 때는 `N8N_REVIEW_URL`로 신뢰할 수 있는 내부 또는 HTTPS 웹훅 주소를 지정한다.

```sh
cp workflows/discord/.env.example workflows/discord/.env
git fetch origin main
uv run --project workflows/discord --locked --env-file workflows/discord/.env python workflows/discord/bot.py
```

상품 근거는 로컬 Git의 `origin/main`에서 읽는다. 기준 브랜치 변경 후 fetch하고, 다른 기준은 `PRODUCT_REF`로 지정한다. 포크에서는 위 GitHub 노드 설정과 봇의 `ISSUE_REPOSITORY`를 같은 저장소로 맞춘다. 기존 동작 조회는 `OPENAI_MODEL`(기본 `gpt-5.4-mini`)이 답한다. 변경 요청은 `OPENAI_REASONING_MODEL`(기본 `gpt-5.4`)의 중간 추론으로, 복합 영향 분석은 같은 모델의 높은 추론으로 넘긴다. 영향 분석에는 동일 커밋의 상품 통합 테스트도 제공한다. 단계가 바뀌는 턴에는 추가 호출이 발생한다. 다음 답글은 해당 글에 봇이 남긴 단계 표시에서 바로 이어간다.

4. 포럼에 “상품 정렬을 추가하고 싶어요”라는 글을 만들고 질문에 답한다. 담당자가 제목·본문·근거를 확인하고 **이 내용으로 이슈 등록**을 누르면 같은 글에 이슈 링크가 표시된다. 초안을 수정하거나 거절하려면 담당자 폼에서 `discord:포럼글ID`를 조회한다. 글에 **조회**를 쓰면 변경된 초안과 새 승인 버튼 또는 이미 등록한 이슈를 다시 볼 수 있다. 생성 결과 확인 중에는 위의 **기존 이슈 연결** 절차를 사용한다.

Discord 대화·근거·역할 검증 회귀 테스트는 저장소 루트에서 `uv run --project workflows/discord --locked python -m unittest discover -s workflows/discord`로 실행한다.

### TODO · 기획 질문을 어디까지 받을지 검증하기

- [ ] 다음 기능 요청 3건에서 Discord는 사용자에게 보이는 동작과 수용 예시를 확인하고, 개발자는 승인된 이슈를 바탕으로 저장소에서 OpenSpec을 작성한다. 가격 정렬이라면 정렬 방향·기본값·동률 시 기대 순서를 Discord에서 묻고, 쿼리 표기와 잘못된 입력의 처리 방식은 기존 계약에 맞춰 개발자가 검토한다. 이미 이슈에 합의된 조건은 그대로 인계한다.
- 세 건을 마친 뒤 Discord 질문 횟수, 개발자가 기획자에게 다시 물은 내용, 명세 검토 중 뒤집힌 결정을 비교한다. 반복되는 제품 질문만 접수 단계로 옮긴다.
