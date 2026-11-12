# 쇼핑몰 데모

Codex와 AI 개발 도구를 사용하며 작은 쇼핑몰 API를 만드는 연습 저장소다.

## 실행

Java 21을 사용한다. Gradle은 별도 설치 없이 저장소의 Wrapper를 실행한다.

```sh
./gradlew bootRun
```

기본 주소는 `http://localhost:8080`이다. 상품 데이터는 메모리 H2에 보관되며 앱을 종료하면 사라진다. 저장 방식의 배경은 [ADR 0002](docs/adr/0002-로컬-상품-데모는-jpa와-메모리-h2를-사용한다.md)에 있다.

### IntelliJ IDEA에서 실행

저장소 루트의 `settings.gradle.kts` 또는 `build.gradle.kts`를 Gradle 프로젝트로 연다. Project SDK와 Settings → Build, Execution, Deployment → Build Tools → Gradle의 Gradle JVM을 JDK 21로 지정하고, Gradle 배포는 Wrapper를 사용한다. Gradle 동기화가 끝나면 `ShopDemoApplication.main()` 또는 Gradle의 `bootRun`을 실행한다. 기본 포트 8080을 사용하는 다른 앱이 있으면 먼저 종료하거나 실행 인수에 `--server.port=8081`을 지정한다.

기반 파일은 IntelliJ의 Spring Boot 생성 마법사도 사용하는 Spring Initializr에서 생성했다. 생성 원본에서 H2 웹 콘솔 의존성을 제외하고 Wrapper 다운로드 SHA-256 검증을 추가했으며, 상품 구현과 설정·테스트는 그 위에 작성했다. `.idea`와 `.iml`은 실행 필수 파일이 아니다.

## 상품 API

| 요청 | 동작 | 성공 응답 |
| --- | --- | --- |
| `POST /products` | 상품 등록 | `201`과 등록한 상품 객체 |
| `GET /products` | 상품 목록 조회 | `200`과 id 오름차순 배열. 상품이 없으면 `[]` |

이름은 공백만으로 이루어지지 않은 1~100자 문자열이다. 앞뒤 공백은 입력한 대로 유지한다. 가격은 원 단위의 0 이상 정수이며 Java `Long` 범위까지 받는다. 숫자 문자열이나 소수는 허용하지 않는다.

```sh
curl -i http://localhost:8080/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"스터디 노트","price":12000}'
curl http://localhost:8080/products
```

새로 실행한 앱에서 위 요청의 등록 응답은 `{"id":1,"name":"스터디 노트","price":12000}`, 목록 응답은 `[{"id":1,"name":"스터디 노트","price":12000}]`이다. id는 서버가 생성한다.

필수 값 누락·잘못된 타입·이름 길이 위반·음수 가격·잘못된 JSON은 `400`과 `application/problem+json` 오류로 응답하고 저장하지 않는다. 현재 API는 등록과 목록 조회를 제공한다.

## 빌드와 검증

```sh
./gradlew test
./gradlew bootJar
```

테스트는 MockMvc에서 실제 서비스·JPA·H2까지 연결해 등록·조회·입력 오류를 검증한다. 실행 JAR은 `build/libs/shop-demo-0.0.1-SNAPSHOT.jar`에 생성된다.

AI 도구 설정·실행 명령은 [AI 개발 환경](docs/ai-harness.md), 변경 관리 기준은 [프로젝트 작업 지침](AGENTS.md)을 따른다.
