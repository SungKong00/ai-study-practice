# 프로젝트 작업 지침

- 하나의 Spring Boot 데모를 유지한다. 도구 비교나 여러 회차 스터디 운영을 위한 구조로 확장하지 않는다.
- AI 개발 환경을 준비하거나 설정을 변경할 때는 [설정과 사용법](docs/ai-harness-plan.md)을 확인한다.
- OpenSpec 작업에는 [설치된 전용 Skills](.agents/skills/)를 사용한다. 산출물 언어는 [OpenSpec 설정](openspec/config.yaml)을 따른다.
- 설계 결정을 조회·관리할 때는 adrs MCP 또는 `npm run adr -- <명령>`을 사용한다. 작성·상태 변경은 [ADR 작업 지침](docs/AGENTS.md)을 따른다.
- ADR을 브라우저에서 조회할 때는 `npm run adr:preview`로 Log4brains를 실행한다.
- 외부 라이브러리의 API·설정 근거가 필요하면 [Context7 사용 기준](docs/ai-harness-plan.md#context7)에 따라 조회한다. MCP 연결은 [.codex/config.toml](.codex/config.toml)에서 관리한다.
- Showboat 보고를 요청받으면 [실행 조건·절차·보관 기준](docs/ai-harness-plan.md#showboat)을 확인한다.
- 파일 변경을 완료하면 작업 단위별로 나누어 커밋한다. 커밋 메시지는 한글로 작성한다.
- 최종 응답 마지막에 커밋 해시와 메시지를 보고한다. 커밋하지 못했다면 그 이유를 적는다.
