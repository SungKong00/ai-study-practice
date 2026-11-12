# Proposal

## Why

AI 하네스를 실제 기능 개발에 적용할 첫 사례로 쇼핑몰의 상품 등록·목록 조회를 구현한다. 현재 저장소에는 하네스 설정만 있으므로 실행 가능한 Spring Boot 프로젝트와 API 검증 기반이 필요하다.

## What Changes

- Java 21·Spring Boot 4.1.2·Gradle Kotlin DSL 기반의 단일 애플리케이션을 구성한다.
- 이름과 가격을 가진 상품을 H2에 저장하는 `POST /products`를 추가한다.
- 등록된 상품을 조회하는 `GET /products`를 추가한다.
- 잘못된 입력의 거부와 저장·조회 흐름을 자동 테스트한다.
- 실행 방법과 API 계약을 기존 문서 구조에 연결한다.
- 상품 수정·삭제, 주문·장바구니·결제·회원 인증은 포함하지 않는다.

## Capabilities

### New Capabilities

- `product-catalog`: 상품 이름·가격을 등록하고 등록된 상품 목록을 조회한다.

### Modified Capabilities

없음. 기존 기능 명세와 애플리케이션 코드는 없다.

## Impact

- 루트에 Gradle Wrapper와 애플리케이션 빌드를 추가하고 `src/`에 구현·테스트를 둔다.
- Spring MVC·Validation·Spring Data JPA·H2를 사용한다.
- AI 도구의 Node.js 설정과 기존 ADR 원본은 유지한다.
- 저장 방식과 실행 구조의 결정은 기존 ADR을 확인한 뒤 별도 ADR에 기록한다.
