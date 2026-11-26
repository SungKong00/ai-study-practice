---
name: prepare-pr
description: “PR 올려줘”, “PR 준비해줘”, “PR 초안 써줘” 요청에서 브랜치 변경을 검토하고 저장소 PR 양식으로 제출하거나 초안을 보여준다.
---

1. 대상 브랜치와 현재 브랜치의 공통 조상부터 커밋·diff를 확인하고 작업 트리도 확인한다. 이슈와 무관한 커밋이 섞였거나 제출 범위가 모호하면 해당 변경을 짚고 범위를 정한 뒤 진행한다.
2. 제품 기능 PR은 `scripts/verify-product-pr <이슈번호> <변경명>`으로 원본 완료 예시와 Gradle 결과를 확인하고 [OpenSpec 검증](../openspec-verify-change/SKILL.md)으로 예시·구현·테스트를 대조한다. 조회 실패·제품 회귀·미결 정책은 제출 전에 해결한다. 완료된 변경은 [보관](../openspec-archive-change/SKILL.md)에서 동기화 결과를 확인하고, 부분 PR은 미구현 요구를 분리한 뒤 [검증된 범위만 동기화](../openspec-sync-specs/SKILL.md)한다. 기준 명세 diff와 `openspec validate --all --strict`를 확인한다.
3. Spring 코드·설정 변경은 [Spring 변경 리뷰](../spring-change-review/SKILL.md)를 읽고 제출할 diff에 적용한다. 지적의 근거와 사용자 영향을 제시한다. 미결 정책이나 수정이 필요한 회귀는 개발자의 결정 또는 수정 후 진행한다. 수정한 경로는 다시 검토한다.
4. 리뷰 후 [PR 템플릿](../../../.github/pull_request_template.md)을 읽고 최종 diff 기준으로 채운다. 확인한 이슈 번호·명세, 사용자에게 달라지는 동작, 검토한 조건과 실제 테스트 결과를 적는다. 미실행 검증은 구분한다. 결정이 필요할 때만 리뷰어에게 구체적인 질문을 남긴다.
5. 준비·초안 요청이면 제목과 본문을 반환한다. 제출 요청이면 [커밋 정리](../commit-change/SKILL.md)를 적용한 뒤 검증된 diff와 같은 커밋을 푸시하고 같은 head/base의 기존 PR을 확인해 생성하거나 갱신한다. 본문은 파일로 전달하고 PR 링크를 반환한다.

머지 요청은 [PR 머지](../merge-pr/SKILL.md)로 처리한다.
