## MODIFIED Requirements

### Requirement: 상품 목록 조회

시스템은 유효한 `GET /products` 요청에 HTTP 200과 `id`, `name`, `price`를 포함한 상품의 JSON 배열로 응답해야 한다(SHALL). `sort` 생략 시 id 오름차순, `sort=price,asc` 또는 `sort=price,desc` 지정 시 각각 가격 오름차순 또는 내림차순으로 정렬하고 가격 동률은 항상 id 오름차순이어야 한다(MUST). 그 외 값이나 반복된 `sort`는 HTTP 400으로 거부해야 한다(MUST).

#### Scenario: 빈 상품 목록
- **WHEN** 등록된 상품이 없는 상태에서 유효한 정렬로 목록을 조회한다.
- **THEN** HTTP 200과 빈 배열 `[]`을 반환한다.

#### Scenario: 등록한 상품 조회
- **WHEN** 두 상품을 등록한 뒤 정렬을 생략하고 목록을 조회한다.
- **THEN** 등록 시 받은 id·이름·가격을 id 오름차순으로 반환한다.

#### Scenario: 가격 정렬과 동률
- **WHEN** id 1, 2, 3의 가격이 각각 200원, 100원, 200원인 목록을 가격순으로 조회한다.
- **THEN** 가격 오름차순이면 id 2, 1, 3 순서로, 내림차순이면 id 1, 3, 2 순서로 반환한다.

#### Scenario: 잘못된 정렬
- **WHEN** 지원하지 않는 필드나 방향, 빈 값 또는 둘 이상의 sort 값을 보낸다.
- **THEN** HTTP 400을 반환한다.
