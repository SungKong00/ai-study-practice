---
number: 1
title: ADR을 하나의 MADR 원본으로 관리한다
status: accepted
date: 2026-11-12
---

# ADR을 하나의 MADR 원본으로 관리한다

## Context and Problem Statement

Codex와 사람이 같은 설계 결정을 조회해야 한다. ADR 작성 형식은 MADR, 생성·검색·상태·대체 관계 관리는 adrs, 브라우저 조회는 Log4brains가 맡는다.

adrs 0.13.0의 MADR 메타데이터는 YAML에 있지만 Log4brains 1.1.0은 본문 목록에서 읽는다. 기본 출력으로 시험하면 제안 상태가 승인 상태로 표시되고 날짜가 인식되지 않았다.

## Considered Options

- 기본 MADR 출력을 그대로 읽기: 상태·날짜·대체 관계가 정확하지 않다.
- 표시용 Markdown 파일 생성: 원본은 하나지만 별도 생성물을 관리해야 한다.
- Log4brains의 읽기 단계 보완: 원본을 직접 읽고 메모리에서 메타데이터를 전달한다.

## Decision Outcome

`docs/adr/`의 YAML 메타데이터와 MADR 본문을 유일한 원본으로 둔다. adrs CLI와 MCP로 생성·상태·대체 관계를 관리하고, 본문은 직접 편집할 수 있다.

사용자 선택에 따라 Log4brains의 읽기 단계에 호환 코드를 적용한다. 별도 ADR 파일을 생성하지 않는다. 호환 코드는 `scripts/log4brains-madr.cjs`, 적용과 버전 검사는 `scripts/patch-log4brains.cjs`가 담당한다. `npm ci` 시 적용되며 Log4brains의 쓰기 API는 차단한다.

### Consequences

- CLI·MCP·브라우저가 같은 ADR 원본을 사용하며 Git 이력도 유지한다.
- Log4brains 1.1.0을 고정한다. 버전 변경 시 호환 코드를 재검증해야 한다.
- 상태·대체 관계와 원본 보존은 `npm run harness:check`로 확인한다.
