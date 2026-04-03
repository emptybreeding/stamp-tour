/**
 * Firebase 웹 앱 설정값을 넣어주세요.
 * Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성
 *
 * KAKAO_LOGIN_ENDPOINT:
 *   아래 functions/index.js 를 Firebase Functions에 배포한 뒤,
 *   생성된 HTTPS URL을 넣습니다.
 *
 * KAKAO_REST_API_KEY:
 *   Kakao Developers > 앱 키 > REST API 키
 *
 * KAKAO_REDIRECT_URI:
 *   현재 페이지 URL과 정확히 일치해야 합니다.
 *   예) https://your-domain.com/
 */
window.APP_CONFIG = {
  firebaseConfig: {
    apiKey: "AIzaSyBry7iYrFlaqavBve6Jg1L7K4prIrBFLC",
    authDomain: "stamp-tour-94232.firebaseapp.com",
    projectId: "stamp-tour-94232",
    appId: "1:643695917667:web:aaef5eece7cdc98801656",
  },

  kakao: {
    restApiKey: "",
    redirectUri: window.location.origin + window.location.pathname,
    loginEndpoint: "",
  },
};