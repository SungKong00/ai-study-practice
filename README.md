# 쇼핑몰 데모

Codex와 AI 개발 도구를 사용하며 작은 쇼핑몰 API를 만드는 연습 저장소다.

## 실행

Java 21을 사용한다. Gradle은 별도 설치 없이 저장소의 Wrapper를 실행한다.

```sh
./gradlew bootRun
```

기본 주소는 `http://localhost:8080`이다. 상품 데이터는 메모리 H2에 보관되며 앱을 종료하면 사라진다. 저장 방식의 배경은 [ADR 0002](docs/adr/0002-로컬-상품-데모는-jpa와-메모리-h2를-사용한다.md)에 있다.

## 빌드와 검증

```sh
./gradlew test
./gradlew bootJar
```

AI 도구 설정·실행 명령은 [AI 개발 환경](docs/ai-harness-plan.md), 변경 관리 기준은 [프로젝트 작업 지침](AGENTS.md)을 따른다.
