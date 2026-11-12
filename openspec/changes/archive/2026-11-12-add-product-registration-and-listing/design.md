# Design

## Context

기존 구현·기능 명세는 없고 하네스만 구성되어 있다. 변경의 목적과 범위는 [proposal.md](proposal.md), 외부 계약은 [상품 명세](specs/product-catalog/spec.md)를 따른다.

## Goals / Non-Goals

**Goals:** HTTP 요청부터 검증·트랜잭션·저장·조회까지 하나의 기능 경계 안에서 연결하고 테스트한다.

**Non-Goals:** 범용 공통 계층, 다중 모듈, 운영용 DB·인증·배포 구조를 미리 도입하지 않는다.

## Decisions

- Java 21·Spring Boot 4.1.2·Gradle Kotlin DSL을 사용한다. 기존 Node.js 설정은 하네스용으로 유지하고 애플리케이션 실행은 Gradle Wrapper를 사용한다.
- Spring Data JPA와 메모리 H2의 선택·대안·제약은 [ADR 0002](../../../../docs/adr/0002-로컬-상품-데모는-jpa와-메모리-h2를-사용한다.md)에서 관리한다. 이 문서에 결정 배경을 복제하지 않는다.
- `com.example.shop.product`에 상품 관련 controller·service·repository·entity·요청/응답 DTO를 둔다. 기능별 패키지가 첫 기능의 변경 위치를 모아 준다. 계층마다 별도 최상위 패키지나 범용 추상화를 만들지 않는다.
- HTTP 입력 검증은 요청 DTO가 맡고, service가 저장·조회 트랜잭션을 소유한다. JPA entity를 API 응답으로 직접 노출하지 않는다. 목록은 repository 조회 시 id로 정렬한다.
- `price`는 정수 원 단위의 Long으로 표현한다. JSON 소수·문자열의 숫자 변환은 허용하지 않는다. 입력 오류 응답은 Spring MVC의 기본 Problem Details 지원을 사용한다.
- 통합 테스트에서 MockMvc로 실제 controller·service·repository·H2를 함께 사용한다. 컨트롤러나 저장소를 mock으로 대체하지 않는다. 실행 중인 서버에서도 HTTP 등록·조회와 재시작 초기화를 확인한다.

## Risks / Trade-offs

- [H2와 운영용 DB의 동작 차이] → 외부 DB 검증을 완료했다고 주장하지 않으며 DB 전환 때 별도 결정과 테스트를 추가한다.
- [페이징 없는 목록의 데이터 증가] → 이번 로컬 데모 범위에 한정하고 페이징은 요구사항이 생기면 명세를 변경한다.
- [상품 기능 외의 프로젝트 표준 미확정] → 실제 구현에서 확인한 사용법만 README와 해당 범위의 지침에 기록한다.
