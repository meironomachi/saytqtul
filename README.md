# 일기장

달력에서 날짜를 골라 하루를 기록하는 나만의 일기장. `meiro.kr/saytqtul/` 에서 열립니다.

- 로그인, 관리자 승인 후 가입 (가장 먼저 가입한 사람이 관리자)
- 날짜별 일기 쓰기·수정·삭제, 어제/오늘/내일 이동
- 날씨, 기분 태그(최대 5개)와 점수, 사진, 06~29시 타임테이블(10분 단위, 끌어서 칠하기)
- 댓글, 태그 관리, 이 기기에 자동 임시저장
- 월간 리포트(기분 그래프, 활동 시간), 검색, 타임라인
- 다크모드

빌드 과정 없이 HTML·CSS·JavaScript만으로 돌아가고, 데이터는 Supabase에 저장합니다.

## 처음 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 `supabase/schema.sql` 전체를 붙여 넣고 **Run** 합니다.
3. **Authentication → URL Configuration**에서
   - Site URL: `https://meiro.kr/saytqtul/`
   - Redirect URLs: `https://meiro.kr/saytqtul/`
4. **Project Settings → API**의 Project URL과 anon(public) 키를 `js/config.js`에 넣습니다.

## 폴더 구성

```
├── index.html          # 앱 진입점
├── css/style.css       # 디자인 (흰 바탕 + #0031B0, Pretendard, 다크모드)
├── js/app.js           # 화면과 Supabase 연동
├── js/diary.js         # 일기 규칙 (태그, 타임테이블, 리포트, 검색)
├── js/config.js        # Supabase 연결 정보
├── supabase/schema.sql # 데이터베이스 설정
└── test/               # 규칙 테스트, 화면 확인용 가짜 데이터
```

## 올리기 전에

```sh
node tools/bump-version.mjs   # css·js 주소에 새 버전을 붙여 브라우저가 새 파일을 받게 함
```

## 테스트

```sh
node --test test/*.test.mjs
```

화면만 확인할 때는 `index.html`의 `js/app.js` 앞에 `<script src="test/mock-client.js"></script>`를 넣은 복사본을 로컬 서버로 열면 가짜 데이터로 돌아갑니다.
