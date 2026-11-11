# ADR 작업 지침

다음 규칙은 `docs/adr/`의 ADR에 적용한다.

- 새 결정은 adrs CLI 또는 MCP로 생성하고 [MADR 템플릿](adr/template.md)의 본문을 채운다. YAML 필드명과 본문 구조 제목은 유지하고 설명은 한국어로 작성한다.
- 상태·대체 관계는 adrs CLI 또는 MCP로 변경한다. Log4brains는 조회 전용이다.
- 날짜는 Asia/Seoul 기준 `YYYY-MM-DD`로 기록한다. adrs는 UTC 날짜를 생성하므로 날짜가 다르면 원본의 YAML `date`를 맞춘다.
- `docs/adr/` 안에는 AGENTS.md를 추가하지 않는다. Log4brains가 일반 Markdown도 ADR로 읽으므로 ADR 지침은 이 파일에서 관리한다.
