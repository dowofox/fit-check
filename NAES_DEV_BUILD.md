# NAES Development Build

NAES는 Expo Go와 프로젝트 전용 Development Build를 모두 지원합니다. Development Build는 `expo-dev-client`가 포함된 NAES 전용 디버그 앱입니다.

## 최초 1회 설정

1. 패키지를 설치합니다.

   ```bash
   npm install
   ```

2. EAS CLI를 설치하고 로그인합니다.

   ```bash
   npm install -g eas-cli
   eas --version
   eas login
   ```

   `eas.json`은 EAS CLI `16.18.0` 이상을 요구합니다.

3. Expo 프로젝트를 EAS에 연결합니다.

   ```bash
   eas init
   ```

   이 명령은 실제 Expo 계정의 프로젝트를 만들거나 연결하고 `app.json`의 `extra.eas.projectId`를 추가합니다. 저장소에는 임의의 `projectId`를 넣지 않았습니다.

## Android Development Build 만들기

프로젝트 루트에서 실행합니다.

```bash
eas build --profile development --platform android
```

빌드가 끝나면 EAS가 제공하는 설치 링크에서 APK를 Android 기기에 설치합니다. 네이티브 패키지나 `app.json`의 네이티브 설정이 바뀌면 Development Build를 다시 만들어야 합니다.

## 개발 서버 실행

1. API 서버를 실행합니다.

   ```bash
   node server/index.js
   ```

2. 다른 터미널에서 Development Client용 Metro를 실행합니다.

   ```bash
   npx expo start --dev-client
   ```

3. Android 기기에서 설치한 NAES 개발 앱을 열고 표시된 개발 서버에 연결합니다.

동일한 명령을 npm 스크립트로 실행할 수도 있습니다.

```bash
npm run start:dev-client
```

## 로컬 API 연결 주의사항

현재 앱 API 주소는 `utils/api.ts`의 `API_BASE_URL`에서 한 번만 관리합니다.

- 개발 PC와 Android 기기가 같은 Wi-Fi에 연결되어야 합니다.
- PC의 IP가 바뀌면 `utils/api.ts`의 `API_BASE_URL`만 변경하면 됩니다.
- Windows 방화벽에서 Node.js와 `3001` 포트 접근이 허용되어야 합니다.
- Android Development Build에서 로컬 HTTP 서버를 쓸 수 있도록 cleartext 통신이 현재 허용되어 있습니다. Production 배포 전에는 HTTPS API로 전환하고 이 허용 설정을 제거해야 합니다.

## Preview와 Production

내부 테스트용 설치 APK:

```bash
eas build --profile preview --platform android
```

스토어 제출용 Android App Bundle:

```bash
eas build --profile production --platform android
```

`preview`는 내부 설치용이며 Metro가 필요 없는 독립 빌드입니다. `production`은 기본적으로 스토어 제출용 AAB를 생성합니다.

## Expo Go 계속 사용하기

기존 Expo Go 테스트도 유지됩니다.

```bash
npx expo start --go
```

또는:

```bash
npm run start:go
```

`npx expo start` 실행 후 터미널에서 `s`를 눌러 Expo Go와 Development Build 대상을 전환할 수도 있습니다.

## 문제 확인

- 개발 앱이 Metro를 찾지 못하면 같은 Wi-Fi와 방화벽을 먼저 확인합니다.
- API 요청이 실패하면 서버 터미널, PC IP, `3001` 포트를 확인합니다.
- EAS 빌드가 프로젝트 연결을 요구하면 `eas init`을 먼저 실행합니다.
- 새 네이티브 라이브러리를 설치했다면 기존 APK가 아니라 새 Development Build가 필요합니다.
