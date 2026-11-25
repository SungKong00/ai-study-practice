## Why

[승인된 요청 #5](https://github.com/SungKong00/ai-study-practice/issues/5)는 상품을 목록에서 하나씩 찾는 불편을 줄이려 한다.

## What Changes

상품 목록에 이름 완전 일치 필터를 추가한다. 기존 응답 형태와 정렬을 유지한다.

## Capabilities

### New Capabilities

### Modified Capabilities

- `product-catalog` — 이름으로 상품 목록을 제한한다.

## Impact

목록 컨트롤러, 조회 서비스, JPA 저장소와 API 테스트를 변경한다.
