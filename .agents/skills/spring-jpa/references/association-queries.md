# 연관 조회와 페이징 검증

**N+1** — 부모 1건과 여러 건으로 같은 조회와 응답 변환을 실행한다. 매번 새 영속성 컨텍스트를 쓰고 2차 캐시 조건을 맞춘다. 준비 SQL과 페이지 `count`를 빼고 부모마다 같은 연관 SELECT가 반복되는지 센다. 재현된 연관에 fetch join·배치 조회·DTO 조회를 검토한다.

**자식 컬렉션을 포함한 부모 페이징**

1. 자식이 없는 부모와 여러 자식을 둔 부모로 인접 페이지를 조회한다. 부모의 순서·누락·중복과 자식 목록을 기대값과 대조한다. 전체 건수를 반환하면 조회 조건에 맞는 부모 수와 비교한다.
2. 목록 SQL과 ORM 경고로 DB가 부모를 먼저 제한했는지, 전체 조인 결과를 JVM에서 잘랐는지 판별한다. Hibernate 7.4는 서브쿼리의 limit·offset을 지원하는 DB에서 부모를 먼저 제한할 수 있다. [Hibernate 7.4 변경 사항](https://docs.hibernate.org/orm/7.4/whats-new/)

메모리 페이징이면 정렬된 부모 키를 먼저 페이징한 뒤 자식을 조회하는 방법을 검토한다. `IN`만으로는 반환 순서를 보장하지 않으므로 첫 조회의 키 순서로 조립한다. [JetBrains JPA 실습](https://blog.jetbrains.com/idea/2026/03/ai-assisted-java-application-development-with-agent-skills/)
