---
name: merge-pr
description: PR 머지를 요청받으면 대상 브랜치·승인·CI·최종 head를 확인하고 이슈 종료까지 검증한다.
---

머지 요청 시 base·head·최종 diff와 저장소가 요구하는 리뷰·체크를 확인한다. 검사한 head를 지정해(`gh pr merge --match-head-commit <SHA>`) 저장소가 허용하는 방식으로 머지한다. 미통과·충돌은 상태를 보고한다.
머지 결과와 연결 이슈의 실제 상태를 조회한다. 관련 없는 브랜치 삭제나 강제 푸시는 하지 않는다.
