# 로부르인덱스 공개 URL 만들기

이 폴더(`robur-index`)를 GitHub에 올린 뒤 Render 같은 Node 배포 서비스에 연결하면 누구나 접속 가능한 URL이 생깁니다.

## 가장 쉬운 순서

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더 안의 파일 전체를 저장소에 업로드합니다.
   - `node_modules` 폴더는 올리지 않아도 됩니다.
   - `data` 폴더는 올리지 않아도 됩니다.
3. Render에서 `New Web Service`를 선택합니다.
4. 방금 만든 GitHub 저장소를 연결합니다.
5. 설정값은 아래처럼 넣습니다.

```txt
Build Command: corepack enable && pnpm install --frozen-lockfile && pnpm build
Start Command: pnpm start
Node Version: 22.11.0
```

6. 배포가 끝나면 Render가 `https://...onrender.com` 형태의 공개 URL을 만들어줍니다.

## 환경변수

네이버 공식 API 키가 있으면 아래 값을 Render의 Environment에 넣습니다.

```env
NAVER_API_HUB_CLIENT_ID=
NAVER_API_HUB_CLIENT_SECRET=
```

구글 순위를 정확히 추적하려면 아래 값을 넣습니다.

```env
SERPAPI_KEY=
```

키가 없으면 네이버 블로그는 공개 검색 기준으로 시도하고, 구글은 Google 차단 상황에 따라 실패로 기록될 수 있습니다. 앱은 임의/가짜 순위를 만들지 않습니다.

## 이미 준비된 배포 파일

- `render.yaml`: Render 자동 배포 설정
- `server.mjs`: 배포용 PORT 자동 인식 적용됨
- `dist/`: 빌드된 화면 파일
- `scripts/`: 네이버/구글 순위 확인 스크립트
