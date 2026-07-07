# ROBUR INDEX

로부르컴퍼니의 고객·프로젝트·검색 키워드 순위를 관리하는 실행 가능한 MVP입니다.

## 실행

Node.js 22.5 이상이 필요합니다.

```bash
pnpm install
pnpm dev
```

- 화면: http://localhost:5173
- API 및 DB: http://localhost:8787

프로덕션 형태로 실행하려면:

```bash
pnpm build
pnpm start
```

http://localhost:8787 에 접속합니다.

## 실제 네이버 블로그 순위 확인

1. 네이버 클라우드 플랫폼의 `NAVER API HUB`에서 Application을 등록하고 **검색 > 블로그** API를 선택합니다.
2. `.env.example`을 복사해 `.env` 파일을 만듭니다.
3. 발급받은 값을 입력합니다.

```env
NAVER_API_HUB_CLIENT_ID=발급받은_Client_ID
NAVER_API_HUB_CLIENT_SECRET=발급받은_Client_Secret
```

4. 서버를 다시 시작합니다.
5. `키워드 관리`에서 검색 엔진이 `네이버 블로그`인 키워드의 수집 버튼을 누릅니다.

네이버 API의 블로그 검색 결과 상위 100개를 조회해 등록 URL과 비교합니다. API 키가 없거나 인증에 실패하면 Mock 순위를 저장하지 않고 수집 실패로 기록합니다. 네이버 블로그 외 검색 엔진은 아직 Mock Provider를 사용합니다.

API 키가 없는 경우에는 네이버 공개 **PC 통합검색의 블로그 영역**을 낮은 빈도로 조회하는 `NaverPublicSearchProvider`가 자동 사용됩니다. 같은 검색은 5분 동안 캐시하며 요청 간 최소 1.5초 간격을 적용합니다. 네이버가 접근을 제한하거나 CAPTCHA를 반환하면 우회하지 않고 수집 실패로 기록합니다. 로그인 여부, 개인화, 디바이스에 따라 사용자가 직접 보는 순위와 차이가 날 수 있습니다.

네이버 카페·파워링크·구글은 실제 Provider가 연결되기 전까지 수동 수집 시 임의 순위를 만들지 않고 미지원 오류를 기록합니다. `MockSearchProvider`는 샘플 데이터 생성용으로만 남아 있으며 운영 수집 경로에서는 호출되지 않습니다.

## 구현 범위

- 대시보드 지표, 7일 평균 순위 차트, 상태 분포
- 고객 및 프로젝트 등록·조회
- 키워드/URL 등록, 검색, 상태 필터
- Mock Search Provider를 통한 수동 순위 수집
- SQLite에 고객, 프로젝트, 키워드, 30일 RankHistory 영구 저장
- 키워드 상세 30일 역순위 차트
- 반응형 B2B 관리자 UI
- URL 형식 검증 및 중복 등록 방지

`server.mjs`의 `MockSearchProvider`와 동일한 반환 규격으로 실제 네이버/구글 Provider를 추가할 수 있습니다.
