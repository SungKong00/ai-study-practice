# 프로젝트 작업 지침

- 하나의 Spring Boot 데모를 유지한다. 도구 비교나 여러 회차 스터디 운영을 위한 구조로 확장하지 않는다.
- 애플리케이션 실행·검증은 [README](README.md)의 Gradle 명령을 사용한다. Node.js 명령은 AI 하네스용이다.
- AI 개발 환경을 준비하거나 설정을 변경할 때는 [설정과 사용법](docs/ai-harness-plan.md)을 확인한다.
- 새 기능 추가나 API 계약·업무 규칙 변경에는 별도 호출 없이 [OpenSpec Skills](.agents/skills/)를 사용한다. 산출물 언어는 [OpenSpec 설정](openspec/config.yaml)을 따른다.
- 오타·서식 수정, 기존 명세를 복구하는 국소 버그 수정, 동작을 유지하는 단순 정리는 OpenSpec을 생략한다.
- 여러 기능에 영향을 주거나 되돌리기 어려운 구조·저장 방식·핵심 의존성·보안 정책을 선택할 때는 adrs MCP 또는 `npm run adr -- <명령>`으로 관련 ADR을 먼저 조회한다. 기존 결정으로 설명되지 않는 선택이나 결정의 대체가 필요할 때만 [ADR 작업 지침](docs/AGENTS.md)에 따라 MADR로 기록한다.
- ADR을 브라우저에서 조회할 때는 `npm run adr:preview`로 Log4brains를 실행한다.
- 외부 라이브러리의 API·설정 근거가 필요하면 [Context7 사용 기준](docs/ai-harness-plan.md#context7)에 따라 조회한다. MCP 연결은 [.codex/config.toml](.codex/config.toml)에서 관리한다.
- Showboat 보고를 요청받으면 [실행 조건·절차·보관 기준](docs/ai-harness-plan.md#showboat)을 확인한다.
- 파일 변경을 완료하면 작업 단위별로 나누어 커밋한다. 커밋 메시지는 한글로 작성한다.
- 최종 응답 마지막에 커밋 해시와 메시지를 보고한다. 커밋하지 못했다면 그 이유를 적는다.
