## Why

상품 목록에서 저렴한 상품이나 비싼 상품부터 보고 싶다는 요청이 승인됐다. [이슈 #1](https://github.com/SungKong00/ai-study-practice/issues/1)

## What Changes

목록 조회에 선택적인 가격 정렬을 추가한다. 정렬을 생략한 클라이언트에는 기존 순서로 응답한다.

## Capabilities

### Modified Capabilities

- `product-catalog`의 상품 목록 조회에 가격순, 동률 처리, 잘못된 정렬 요청의 거절 조건을 추가한다.

## Impact

`GET /products` 요청 처리, JPA 목록 쿼리, API 통합 테스트와 사용 예시가 대상이다.
