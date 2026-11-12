# AI 개발 환경 설정과 남은 계획

## 목적과 현재 범위

하나의 Spring Boot 데모 저장소에서 Codex로 개발하는 환경을 구성하고, 설정과 사용 방법을 스터디원에게 공유한다. 애플리케이션 실행과 API 사용법은 [README](../README.md)에서 관리한다.

공유 설정과 Skills는 저장소에 둔다. 실행 도구는 기존 로컬 설치를 우선 재사용하며, 개인 인증 정보는 저장소 밖에서 관리한다.

## 적용한 구성

| 구성 | 설정 위치와 역할 |
|---|---|
| OpenSpec 1.14.3 | `openspec/config.yaml`, `.agents/skills/openspec-*`. 요구사항·변경 계획·작업·완료된 변경을 관리한다. 산출물은 한국어로 작성하고 구조 제목과 SHALL/MUST는 영어로 유지한다. |
| adrs 0.13.0 + MADR | `adrs.toml`, `docs/adr/template.md`. `docs/adr/`의 원본을 생성·검색하고 상태·대체 관계를 관리한다. 실행 파일은 `.tools/bin/adrs`에 설치한다. |
| Log4brains 1.1.0 | `.log4brains.yml`. 같은 ADR 원본을 브라우저에서 조회한다. 쓰기는 adrs가 맡는다. |
| adrs MCP | `.codex/config.toml`. 저장소의 adrs 실행 진입점을 사용해 Codex에서 ADR을 조회·관리한다. |
| Context7 MCP | `.codex/config.toml`의 원격 OAuth 연결. 외부 라이브러리 문서와 사용 예시를 조회한다. 개인 로그인 정보는 Codex가 저장소 밖에 보관한다. |
| Showboat 0.6.1 | `package.json`의 `showboat` 명령. 기존 uv로 고정 버전을 실행한다. 명시적인 보고 요청에만 사용한다. |

직접 만든 개발 Skill은 아직 없다. 현재 `.agents/skills/`의 6개는 OpenSpec이 제공한 기본 Skill이다. 전역 Codex 실행 설정은 변경하지 않았다.

## 처음 준비하기

현재 검증 환경은 macOS arm64, Node.js 22.17.0, Python 3, uv다. Git과 Codex CLI도 필요하다.

```sh
npm ci
npm run tools:setup
codex mcp login context7
```

`npm ci`는 Log4brains의 읽기 호환 코드를 적용하고 웹 미리보기 빌드를 준비한다. `tools:setup`은 고정한 adrs 배포 파일의 SHA-256을 확인해 프로젝트 안에 설치한다. Context7 로그인은 사용하는 사람마다 완료한다. 프로젝트의 MCP 설정을 읽으려면 Codex가 신뢰하는 프로젝트여야 한다.

새 설정이 현재 채팅에 나타나지 않으면 이 프로젝트의 새 채팅에서 MCP와 Skills 목록을 확인한다.

## OpenSpec

OpenSpec·ADR 적용 여부는 [루트 작업 지침](../AGENTS.md)의 기준을 따른다.

Codex에서 `$openspec-propose`를 지정하거나 Skills 목록에서 `openspec-propose`를 선택해 변경안을 정리한다. 구현에는 `openspec-apply-change`를 사용한다. 나머지 절차는 각 `SKILL.md`를 따른다.

기능 요구사항과 개발 방식이 정해지면 OpenSpec 작업에 직접 만든 개발 Skill을 연결한다.

## ADR 관리와 브라우저 조회

원본은 `docs/adr/`의 번호가 붙은 Markdown 파일이다. 작성 규칙은 [ADR 작업 지침](AGENTS.md), 템플릿은 [template.md](adr/template.md)를 따른다.

```sh
npm run adr -- new "결정 제목"
npm run adr -- status 2 accepted
npm run adr -- new --supersedes 2 "대체하는 결정 제목"
npm run adr -- doctor
npm run adr:preview -- --no-open
npm run adr:build
npm run harness:check
```

미리보기는 기본 `http://localhost:4004/`, 정적 사이트 생성물은 `.log4brains/out/`이다. 생성물과 실행 파일은 커밋하지 않는다.

Log4brains는 adrs의 YAML 메타데이터를 기본 지원하지 않으므로 읽기 단계에 호환 코드를 적용했다. 원본을 직접 읽고 메모리에서 상태·날짜·대체 관계를 전달하며, 별도 ADR 파일을 생성하지 않는다. 적용 대상은 CLI와 웹 빌드의 두 진입점이다. 버전 변경 시에는 `harness:check`와 브라우저 표시를 다시 검증한다. 결정 배경과 제약은 [ADR 0001](adr/0001-manage-adr-with-madr-and-adrs.md)에 둔다.

## Context7

라이브러리 API·설정을 확인할 때 프로젝트의 실제 의존성 버전을 먼저 확인한다. `resolve-library-id`로 라이브러리와 제공 버전을 확인하고 `query-docs`로 필요한 내용을 조회한다. 필요한 버전이 없거나 근거가 불분명하면 해당 버전의 공식 문서로 보완한다. 조회한 문서 전체를 저장소에 복사하거나 보고서로 누적하지 않는다.

## Showboat

“이번 변경사항을 Showboat를 활용해서 보고해줘”처럼 명시적인 보고 요청이 있을 때만 사용한다.

1. Codex가 변경 범위와 Git diff를 확인해 변경 내용·이유·영향을 설명한다.
2. `npm run showboat -- <명령>`으로 필요한 명령·API 요청을 실행하고 결과를 기록한다.
3. Codex가 변경 설명과 실행 결과를 함께 보고한다.

보고서는 저장소 밖의 임시 디렉터리에서 작성한다. 보관을 요청받은 경우에만 영구 문서로 남긴다. 로컬 데모 환경과 데이터 변경 등 부작용을 확인한다. `verify`도 기록된 코드를 다시 실행하므로 같은 확인이 필요하다.

Showboat는 Git 변경사항을 자동 분석하거나 보고서를 자동 갱신하는 도구로 사용하지 않는다.

## 이후 개발 지침

Spring 개발용 Skill과 추가 하위 지침은 실제 개발 절차와 책임 범위가 생길 때 작성한다. 선택한 도구를 사용하기 위해 불필요한 Skill을 미리 만들지 않는다.

Claude Code는 필수 대상이 아니다. Rulesync·Archgate·Quorum은 제외한다. Superpowers·GSD·OMX·Beads 등 다른 워크플로 도구는 임의로 추가하지 않는다.
