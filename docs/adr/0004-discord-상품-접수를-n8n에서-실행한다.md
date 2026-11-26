---
number: 4
title: Discord 상품 접수를 n8n에서 실행한다
status: accepted
date: 2026-11-26
---

# Discord 상품 접수를 n8n에서 실행한다

## Context and Problem Statement

기획자는 지정 Discord 포럼에 명령어 없이 글을 쓰고 같은 글에서 수정·승인한다. 팀은 대화부터 이슈 등록까지 한 실행 환경에서 운영하려 한다.

## Considered Options

- Python 서비스가 Gateway 이벤트를 받고 n8n에 승인 요청을 전달한다.
- n8n이 일정 주기로 새 글을 조회하고 승인 링크를 제공한다.
- n8n에 Gateway 노드를 설치해 포럼 이벤트와 버튼을 직접 받는다.

## Decision Outcome

세 번째 방식을 사용한다. 일반 메시지·버튼 이벤트를 서버가 보낼 때 받아 같은 스레드에서 처리하며 대화와 승인 사이의 서비스 경계를 줄인다. 역할과 최신 판본 검증은 모델 밖에서 실행한다.

### Consequences

팀이 운영할 프로세스가 줄어든다. Gateway 연결과 Discord 이벤트 호환성은 커뮤니티 노드에 의존하므로 버전을 고정한다. 업그레이드 전 일반 글 수신, 수정 창 응답, 구판 거절과 중복 승인 처리를 실습 서버에서 확인한다. [설정과 사용법](../../workflows/n8n/README.md#discord-포럼에서-요청하기)
