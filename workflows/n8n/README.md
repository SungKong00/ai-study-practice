# 팀 요청 접수 실습

팀원이 요청을 제출하면 AI가 상품 명세를 읽고 답한다. 새 기능은 담당자의 대기 목록에 들어간다. 담당자가 실제 제목과 본문을 확인하고 승인하면 GitHub 이슈 한 건이 생긴다.

## 처음 실행하기

Docker Compose와 Python 3를 사용한다. 이 디렉터리의 `.env`에 `TRIAGE_DB_PASSWORD=<직접 생성한 비밀번호>`를 저장한다. 로컬 편집기는 루프백 주소로 열리고 접수 기록은 PostgreSQL 볼륨에 남는다.

```sh
cd workflows/n8n
docker compose up -d --wait db
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U triage -d triage < schema.sql
docker compose run --rm --no-deps -T n8n import:workflow --separate --input=/workflows
docker compose up -d n8n
```

[로컬 편집기](http://localhost:5678)에서 첫 소유자 계정을 만들고 아래 연결을 지정한다. 최초 가져오기 이후에는 `docker compose up -d`로 다시 시작한다. 같은 ID의 JSON을 다시 가져오면 편집기에서 수정한 워크플로가 교체된다. n8n Cloud에서는 접근 가능한 PostgreSQL에 [테이블](schema.sql)을 만들고, 편집기의 **Import from File**로 [요청 접수](exports/intake.json)와 [담당자 검토](exports/review.json)를 각각 가져온다. [n8n 가져오기 가이드](https://docs.n8n.io/workflows/export-import/)

| 편집기에서 열 노드 | 연결할 자격 증명 |
|---|---|
| 근거 조회·접수·검토·Discord의 PostgreSQL 노드 | 같은 Postgres 연결. 로컬 호스트는 `db`, 포트는 `5432`, 데이터베이스와 사용자는 `triage`, 비밀번호는 위의 `.env` 값이다. |
| 요청 접수 → AI 분류, 담당자 검토 → 요청 재판정 | OpenAI 자격 증명. 모델은 `분류 입력`에 지정한다. |
| 담당자 검토 → 담당자 검토 | 검토 담당자에게만 공유할 Basic Auth 사용자 이름과 비밀번호. |
| 담당자 검토 → 승인한 이슈 생성, 기존 이슈 읽기 | 연습할 저장소에만 `Issues: write`가 있는 GitHub 자격 증명. |

기본 대상은 `SungKong00/ai-study-practice`다. [상품 근거 조회](exports/evidence.json)를 먼저 가져와 DB 연결을 지정하고 Publish한다. 폼·Discord가 이 하위 워크플로를 호출한다. 포크는 근거 조회의 저장소 식별자·GitHub URL·기준 브랜치, 검토의 GitHub 노드 대상, 상품 포럼의 이슈 링크 대상를 맞춘다. 비공개 저장소는 조회 HTTP 노드에 Contents 읽기 권한을 연결한다. 기존 볼륨은 위 psql 명령으로 스키마를 갱신한다.

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

운영에는 n8n과 PostgreSQL을 실행한다. [단독 운영 결정](../../docs/adr/0004-discord-상품-접수를-n8n에서-실행한다.md) Discord 봇 계정은 Gateway에 연결하는 n8n 자격 증명으로 사용한다.

1. 실습 서버에서 포럼과 검토 역할을 선택하고 Discord Developer Portal에서 Message Content Intent를 켠다. 봇 계정에 채널 보기·메시지 기록 읽기·스레드 메시지 보내기·링크 임베드 권한을 준다. [Discord 권한](https://docs.discord.com/developers/topics/permissions)
2. 셀프 호스팅 n8n의 Community Nodes에서 `@yuniruyuni/n8n-nodes-discord@0.4.7`을 설치한다. [Gateway 노드](https://github.com/yuniruyuni/n8n-nodes-discord) · [수동 설치](https://docs.n8n.io/integrations/community-nodes/installation/manual-install/)
3. 저장소 루트에서 아래 명령으로 Discord 워크플로 두 개를 생성해 가져온다. 네 값은 Discord 개발자 모드에서 복사한 숫자 ID다. 생성 시 저장소의 탐색·구체화 스킬과 이슈 템플릿을 읽으므로, 원본을 변경하면 다시 생성하고 가져온다.

```sh
DISCORD_GUILD_ID=서버ID DISCORD_FORUM_ID=포럼ID DISCORD_REVIEW_ROLE_ID=역할ID DISCORD_APPLICATION_ID=봇ID \
  node workflows/n8n/discord-workflow.cjs > /tmp/discord-gateway.json
cd workflows/n8n
docker compose cp /tmp/discord-gateway.json n8n:/tmp/discord-gateway.json
docker compose exec n8n n8n import:workflow --input=/tmp/discord-gateway.json
```

4. 상품 포럼의 Discord Trigger와 Discord API 요청에 같은 Bot Token 자격 증명을 지정한다. PostgreSQL·OpenAI·GitHub는 위 표의 실습 연결을 재사용한다. 근거 조회 → 담당자 검토 → Discord 연결(내부 호출) → Discord 모델 호출 → Discord 상품 포럼 순서로 게시한다. 교체할 때 기존 워크플로를 내보내고 기존 수신기를 중지한 뒤 새 포럼 흐름을 켠다. 옛 수신기와 함께 실행하면 같은 글을 두 번 처리할 수 있다.
5. 지정 포럼에서 상품 변경을 일반 글로 올리고 같은 글에서 질문에 답한다. 담당자는 **수정 요청**으로 전문을 수정하고 새 미리보기의 **이 내용으로 이슈 등록**을 누른다. 예전 버튼은 만료되고 최종 이슈 링크가 같은 글에 올라온다. `조회`는 현재 판본, `명세`는 해당 커밋의 상품 규칙을 보여준다. `탐색`으로 시작한 논의는 `초안 준비`를 입력할 때까지 초안을 만들지 않는다.

일반 질문은 `gpt-5.4-mini`, 요구 구체화·영향 분석은 `gpt-5.4`의 중간·높은 추론으로 처리한다. 승인 권한과 최신 판본은 DB 및 Discord 역할로 확인한다. 같은 이벤트의 재전달은 30일간 이벤트 ID로 걸러낸다. 재시작 후 새 글이 응답하지 않으면 상품 포럼 흐름의 활성 상태, 노드 설치 버전과 Message Content Intent를 확인한다. 실습용 n8n의 실행 기록에는 대화 원문을 보존하지 않는다.

### TODO · 기획 질문을 어디까지 받을지 검증하기

- [ ] 다음 기능 요청 3건에서 Discord는 사용자에게 보이는 동작과 수용 예시를 확인하고, 개발자는 승인된 이슈를 바탕으로 저장소에서 OpenSpec을 작성한다. 가격 정렬이라면 정렬 방향·기본값·동률 시 기대 순서를 Discord에서 묻고, 쿼리 표기와 잘못된 입력의 처리 방식은 기존 계약에 맞춰 개발자가 검토한다. 이미 이슈에 합의된 조건은 그대로 인계한다.
- 세 건을 마친 뒤 Discord 질문 횟수, 개발자가 기획자에게 다시 물은 내용, 명세 검토 중 뒤집힌 결정을 비교한다. 반복되는 제품 질문만 접수 단계로 옮긴다.

### 재현과 비용 확인

`node --test tests/triage.test.cjs`는 로컬 Git의 세 시점에서 근거 목록과 승인 본문을 대조한다. 전체 이력이 필요하다. 실제 모델로 비교할 때만 저장소 루트에서 `node --env-file=workflows/n8n/.env workflows/n8n/replay-discord.cjs`를 사용한다. 평가용 OPENAI_API_KEY를 지정한다. 이 수동 평가는 시점별 최대 세 번 과금되며 게시 권한을 사용하지 않는다. DB를 실행한 뒤 `python3 workflows/n8n/check-db.py`로 임시 스키마의 마이그레이션·동시 승인·캐시·비용 한도를 검사한다.

운영 모델 호출은 PostgreSQL에서 월 100달러·Discord 메시지당 3회를 예약하고 응답 사용량으로 정산한다. 응답을 잃으면 예약액을 유지한다. 월 합계는 UTC이며 호출별 기록은 후속 호출에서 30일 후 정리한다. 가격·모델을 바꿀 때 `team_model_rate`의 백만 토큰당 USD 단가를 함께 확인한다. n8n 모델 예약 노드의 warning과 월 예약액를 확인한다. 원문 보존을 막기 위해 배포 워크플로의 성공·실패 입력 저장은 꺼 둔다.

게시 장애 시 새 요청 접수와 승인 웹훅을 먼저 중지한다. 기존 이슈가 있으면 승인 당시의 저장소·표식·제목·본문을 대조해 연결한다. 검색 결과가 비어 있어도 전송 실패가 확정되기 전에는 재게시하지 않는다. 롤백 때 DB와 이미 게시된 이슈 번호를 유지하고 구형 승인 버튼을 다시 활성화하지 않는다.

실습 요청 3건은 기획 담당자가 재질문 횟수와 승인 전 수정 시간을, 개발자가 승인 예시의 재해석 횟수·리뷰 시간을 기록해 비교한다. 운영자는 요청 ID의 사용량과 게시 건수를 대조한다. 모델 기본 단가의 출처는 [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)다.
