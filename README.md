# 명료 연습실 (Clarity Lab)

설명하기 · 논쟁하기 · 토론하기를 타이머와 교정 부호로 연습하는 PWA입니다. 글쓰기는 기기에서 바로 저장되고, 온라인이면 Supabase에 프로필·기록·주제 은행을 맞춥니다.

## 로컬에서 실행

```bash
npm install
npm run dev
```

브라우저에서 바로 연습할 수 있습니다. `.env`가 없어도 **시드 주제 + 로컬 프로필**로 오프라인 연습이 됩니다.

## Supabase 연결

1. [Supabase](https://supabase.com) 프로젝트를 만듭니다.
2. `supabase/migrations/001_init.sql`을 SQL Editor에서 실행합니다.
3. Authentication에서 이메일 가입을 켭니다.
4. Edge Function `refresh-topics`를 배포합니다.

```bash
npx supabase functions deploy refresh-topics
```

5. 프로젝트 루트에 `.env`를 만듭니다.

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

anon 키만 클라이언트에 넣으세요. service role 키는 Edge Function 환경에만 둡니다.

6. `npm run dev` 후 **로그인 / 가입**, 이어서 설정에서 **주제 새로 가져오기**.

## 동작 요약

| 상황 | 되는 일 | 안 되는 일 |
|---|---|---|
| 온라인 | 로그인, 프로필 CRUD, 주제 갱신, 동기화 | — |
| 오프라인 | 저장된 주제로 추첨, 글쓰기, 고쳐쓰기 | 새 클라우드 프로필, 주제 새로 가져오기 |

추첨은 네트워크를 치지 않습니다. 온라인에서 받아 IndexedDB에 저장한 은행만 사용합니다.

## 스크립트

- `npm run dev` 개발 서버
- `npm run build` 타입 검사 + 프로덕션 빌드
- `npm run preview` 빌드 미리보기
