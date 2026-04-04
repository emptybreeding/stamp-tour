const TOTAL_SPOTS = 31;

const mapViewport = document.getElementById("mapViewport");
const mapStage = document.getElementById("mapStage");
const mapImage = document.getElementById("mapImage");
const markerLayer = document.getElementById("markerLayer");

const remainingCountEl = document.getElementById("remainingCount");
const completedCountEl = document.getElementById("completedCount");
const geoStatusEl = document.getElementById("geoStatus");

const spotModal = document.getElementById("spotModal");
const quizModal = document.getElementById("quizModal");

const spotTitleEl = document.getElementById("spotTitle");
const spotMessageEl = document.getElementById("spotMessage");
const locationCheckTextEl = document.getElementById("locationCheckText");
const missionStartBtn = document.getElementById("missionStartBtn");
const missionCompleteBtn = document.getElementById("missionCompleteBtn");

const spotCloseBtn = document.getElementById("spotCloseBtn");
const quizCloseBtn = document.getElementById("quizCloseBtn");

const choiceO = document.getElementById("choiceO");
const choiceX = document.getElementById("choiceX");
const quizResultArea = document.getElementById("quizResultArea");
const toastEl = document.getElementById("toast");

const quizContent = document.getElementById("quizContent");
const quizFeedbackOverlay = document.getElementById("quizFeedbackOverlay");
const quizFeedbackSymbol = document.getElementById("quizFeedbackSymbol");
const quizFeedbackMessage = document.getElementById("quizFeedbackMessage");

const loginScreen = document.getElementById("loginScreen");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const kakaoLoginBtn = document.getElementById("kakaoLoginBtn");
const guestLoginBtn = document.getElementById("guestLoginBtn");
const loginHelpText = document.getElementById("loginHelpText");
const accountBox = document.getElementById("accountBox");
const accountName = document.getElementById("accountName");
const logoutBtn = document.getElementById("logoutBtn");

const { firebaseConfig, kakao } = window.APP_CONFIG;

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

const state = {
  naturalWidth: 1024,
  naturalHeight: 1536,
  baseScale: 1,
  zoom: 1,
  minZoom: 1,
  maxZoom: 5,
  offsetX: 0,
  offsetY: 0,
  activeSpotId: null,
  activeQuizSpotId: null,
  answeredCorrectly: false,
  userPosition: null,
  watchId: null,
  completed: [],
  markers: [],
  pointers: new Map(),
  pinch: {
    startDistance: 0,
    startZoom: 1,
    worldX: 0,
    worldY: 0,
    centerX: 0,
    centerY: 0,
  },
  drag: {
    active: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  },
};

const markerLayout = [
  { x: 39, y: 19 },
  { x: 54, y: 23 },
  { x: 47, y: 31 },
  { x: 31, y: 36 },
  { x: 54, y: 43 },
  { x: 24, y: 46 },
  { x: 43, y: 47 },
  { x: 66, y: 47 },
  { x: 34, y: 53 },
  { x: 46, y: 57 },
  { x: 21, y: 59 },
  { x: 30, y: 61 },
  { x: 39, y: 63 },
  { x: 49, y: 62 },
  { x: 58, y: 60 },
  { x: 74, y: 61 },
  { x: 31, y: 69 },
  { x: 39, y: 68 },
  { x: 48, y: 69 },
  { x: 62, y: 69 },
  { x: 76, y: 76 },
  { x: 54, y: 76 },
  { x: 41, y: 80 },
  { x: 31, y: 82 },
  { x: 48, y: 84 },
  { x: 65, y: 86 },
  { x: 78, y: 88 },
  { x: 38, y: 92 },
  { x: 55, y: 93 },
  { x: 22, y: 74 },
  { x: 84, y: 52 },
];

const spots = Array.from({ length: TOTAL_SPOTS }, (_, i) => {
  const index = i + 1;
  const layout = markerLayout[i] || {
    x: 20 + (i % 5) * 14,
    y: 20 + Math.floor(i / 5) * 11,
  };

  return {
    id: index,
    title: `${index}번 칸`,
    popupMessage: `${index}번칸입니다`,
    xPercent: layout.x,
    yPercent: layout.y,
    lat: 37.5031 + i * 0.0003,
    lng: 126.7662 + i * 0.0003,
    radius: 50000,
  };
});

function setLoginHelp(message) {
  if (loginHelpText) {
    loginHelpText.textContent = message;
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 1400);
}

function openModal(modalEl) {
  modalEl.classList.remove("hidden");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal(modalEl) {
  modalEl.classList.add("hidden");
  modalEl.setAttribute("aria-hidden", "true");
}

function updateCounters() {
  const completed = state.completed.length;
  const remaining = TOTAL_SPOTS - completed;

  remainingCountEl.textContent = String(remaining);
  completedCountEl.textContent = `${completed} / ${TOTAL_SPOTS}`;
}

function updateAccountUI(user) {
  if (!user) {
    accountBox.classList.add("hidden");
    accountName.textContent = "";
    return;
  }

  let providerLabel = "로그인";
  let displayName = user.displayName || user.email || "사용자";

  if (user.isAnonymous) {
    providerLabel = "게스트";
    displayName = "게스트 사용자";
  } else {
    const providerId =
      (user.providerData &&
        user.providerData[0] &&
        user.providerData[0].providerId) ||
      "custom";

    providerLabel =
      providerId === "google.com"
        ? "Google"
        : providerId === "custom"
        ? "Kakao"
        : "로그인";
  }

  accountName.textContent = `${displayName} · ${providerLabel}`;
  accountBox.classList.remove("hidden");
}

function normalizeCompleted(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_SPOTS)
    ),
  ].sort((a, b) => a - b);
}

async function loadUserProgress() {
  if (!currentUser) {
    state.completed = [];
    renderMarkers();
    updateCounters();
    return;
  }

  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    const snap = await userRef.get();

    if (snap.exists) {
      const data = snap.data() || {};
      state.completed = normalizeCompleted(data.completedSpotIds);
    } else {
      state.completed = [];
      await userRef.set(
        {
          displayName: currentUser.displayName || "",
          email: currentUser.email || "",
          isAnonymous: !!currentUser.isAnonymous,
          completedSpotIds: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    renderMarkers();
    updateCounters();
  } catch (error) {
    console.error("진행 상태 불러오기 실패:", error);
    showToast("저장된 진행 정보를 불러오지 못했습니다.");
    setLoginHelp(`저장 불러오기 실패: ${error.message}`);
  }
}

async function saveCompletedSpot(spotId) {
  if (!currentUser) return;

  const userRef = db.collection("users").doc(currentUser.uid);

  await userRef.set(
    {
      displayName: currentUser.displayName || "",
      email: currentUser.email || "",
      isAnonymous: !!currentUser.isAnonymous,
      completedSpotIds: firebase.firestore.FieldValue.arrayUnion(spotId),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastPlayedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function isCompleted(spotId) {
  return state.completed.includes(spotId);
}

async function markCompleted(spotId) {
  if (isCompleted(spotId)) return;

  state.completed = normalizeCompleted([...state.completed, spotId]);
  updateCounters();
  refreshMarkerState(spotId, true);

  try {
    await saveCompletedSpot(spotId);
  } catch (error) {
    console.error("자동 저장 실패:", error);
    showToast("자동 저장에 실패했습니다. 다시 시도해 주세요.");
  }
}

function resetQuizFeedbackState() {
  quizContent.classList.remove("blurred");
  quizFeedbackOverlay.classList.add("hidden");
  quizFeedbackOverlay.classList.remove("correct", "wrong");
  quizResultArea.textContent = "";
  quizResultArea.className = "quiz-result-area";
  missionCompleteBtn.disabled = true;
  choiceO.disabled = false;
  choiceX.disabled = false;
  clearTimeout(showQuizFeedback.timer);
  clearTimeout(setQuizResult.timer);
}

function closeSpotPopup() {
  closeModal(spotModal);
  state.activeSpotId = null;
}

function closeQuizPopup() {
  closeModal(quizModal);
  state.activeQuizSpotId = null;
  state.answeredCorrectly = false;
  resetQuizFeedbackState();
}

function showQuizFeedback(correct) {
  quizContent.classList.add("blurred");

  quizFeedbackOverlay.classList.remove("hidden", "correct", "wrong");
  quizFeedbackOverlay.classList.add(correct ? "correct" : "wrong");

  quizFeedbackSymbol.textContent = correct ? "O" : "X";
  quizFeedbackMessage.textContent = correct ? "성공입니다" : "다시 시도해보세요";

  quizFeedbackSymbol.style.animation = "none";
  quizFeedbackMessage.style.animation = "none";
  void quizFeedbackOverlay.offsetWidth;
  quizFeedbackSymbol.style.animation = "";
  quizFeedbackMessage.style.animation = "";

  clearTimeout(showQuizFeedback.timer);
  showQuizFeedback.timer = setTimeout(() => {
    quizFeedbackOverlay.classList.add("hidden");
    quizFeedbackOverlay.classList.remove("correct", "wrong");
    quizContent.classList.remove("blurred");
  }, 900);
}

function getSpotById(spotId) {
  return spots.find((spot) => spot.id === spotId) || null;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isInsideSpot(spot) {
  if (!state.userPosition) return false;

  const d = distanceMeters(
    state.userPosition.latitude,
    state.userPosition.longitude,
    spot.lat,
    spot.lng
  );

  return d <= spot.radius;
}

function updateGeoStatusText() {
  if (!state.userPosition) {
    geoStatusEl.textContent =
      "위치 권한을 허용하면 미션 수행 가능 여부를 확인할 수 있어요.";
    return;
  }

  geoStatusEl.textContent = `현재 위치 확인됨 · 위도 ${state.userPosition.latitude.toFixed(
    4
  )}, 경도 ${state.userPosition.longitude.toFixed(4)}`;
}

function renderMarkers() {
  markerLayer.innerHTML = "";
  state.markers = [];

  spots.forEach((spot) => {
    const marker = document.createElement("button");
    marker.className = "mission-marker";
    marker.type = "button";
    marker.style.left = `${spot.xPercent}%`;
    marker.style.top = `${spot.yPercent}%`;
    marker.dataset.spotId = String(spot.id);

    const completeLabel = document.createElement("div");
    completeLabel.className = "marker-complete-label";
    completeLabel.textContent = "투어완료";

    const numberEl = document.createElement("div");
    numberEl.className = "marker-inner";
    numberEl.textContent = String(spot.id);

    const stampEl = document.createElement("div");
    stampEl.className = "marker-stamp";

    marker.appendChild(completeLabel);
    marker.appendChild(numberEl);
    marker.appendChild(stampEl);

    if (isCompleted(spot.id)) {
      marker.classList.add("completed", "disabled");
      marker.disabled = true;
    }

    marker.addEventListener("click", (event) => {
      event.stopPropagation();

      if (!currentUser) {
        showToast("로그인 후 플레이할 수 있습니다.");
        return;
      }

      onMarkerClick(spot.id);
    });

    markerLayer.appendChild(marker);
    state.markers.push({ id: spot.id, element: marker });
  });
}

function refreshMarkerState(spotId, animateStamp = false) {
  const target = state.markers.find((marker) => marker.id === spotId);
  if (!target) return;

  const completed = isCompleted(spotId);

  target.element.classList.toggle("completed", completed);
  target.element.classList.toggle("disabled", completed);
  target.element.disabled = completed;

  if (animateStamp) {
    target.element.classList.remove("stamp-animate");
    void target.element.offsetWidth;
    target.element.classList.add("stamp-animate");
  }
}

function onMarkerClick(spotId) {
  if (isCompleted(spotId)) return;

  state.activeSpotId = spotId;
  state.answeredCorrectly = false;

  const spot = getSpotById(spotId);
  if (!spot) return;

  spotTitleEl.textContent = spot.title;
  spotMessageEl.textContent = spot.popupMessage;

  const available = isInsideSpot(spot);
  missionStartBtn.disabled = !available;
  locationCheckTextEl.textContent = available
    ? "현재 위치에서 미션 수행 가능"
    : "현재 위치가 아니어서 미션수행 비활성화";

  openModal(spotModal);
}

function openQuizForActiveSpot() {
  if (!state.activeSpotId) return;

  state.activeQuizSpotId = state.activeSpotId;
  state.answeredCorrectly = false;

  resetQuizFeedbackState();
  closeModal(spotModal);
  openModal(quizModal);
}

async function finishMissionForActiveSpot() {
  const spotId = state.activeQuizSpotId;
  if (!spotId || !state.answeredCorrectly) return;

  await markCompleted(spotId);
  closeQuizPopup();
  showToast("도장이 찍혔습니다!");
  state.activeSpotId = null;
}

function setQuizResult(correct) {
  choiceO.disabled = true;
  choiceX.disabled = true;

  if (correct) {
    quizResultArea.textContent = "정답입니다";
    quizResultArea.className = "quiz-result-area correct";
    missionCompleteBtn.disabled = false;
    state.answeredCorrectly = true;
  } else {
    quizResultArea.textContent = "오답입니다";
    quizResultArea.className = "quiz-result-area wrong";
    missionCompleteBtn.disabled = true;
    state.answeredCorrectly = false;
  }

  showQuizFeedback(correct);

  clearTimeout(setQuizResult.timer);
  setQuizResult.timer = setTimeout(() => {
    quizResultArea.textContent = "";
    quizResultArea.className = "quiz-result-area";
    choiceO.disabled = false;
    choiceX.disabled = false;
  }, 900);
}

function setupGeolocation() {
  if (!("geolocation" in navigator)) {
    geoStatusEl.textContent = "이 기기에서는 위치 기능을 지원하지 않습니다.";
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.userPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      updateGeoStatusText();

      if (state.activeSpotId) {
        const spot = getSpotById(state.activeSpotId);
        if (spot && !isCompleted(spot.id)) {
          const available = isInsideSpot(spot);
          missionStartBtn.disabled = !available;
          locationCheckTextEl.textContent = available
            ? "현재 위치에서 미션 수행 가능"
            : "현재 위치가 아니어서 미션수행 비활성화";
        }
      }
    },
    (error) => {
      if (error.code === 1) {
        geoStatusEl.textContent =
          "위치 권한이 거부되었습니다. 권한 허용 후 다시 확인해 주세요.";
      } else {
        geoStatusEl.textContent =
          "위치 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
    }
  );
}

function setupMapDimensions() {
  const applyDimensions = () => {
    state.naturalWidth = mapImage.naturalWidth || 1024;
    state.naturalHeight = mapImage.naturalHeight || 1536;

    mapImage.style.width = `${state.naturalWidth}px`;
    mapImage.style.height = `${state.naturalHeight}px`;

    mapStage.style.width = `${state.naturalWidth}px`;
    mapStage.style.height = `${state.naturalHeight}px`;

    fitMapToViewport();
  };

  if (mapImage.complete) {
    applyDimensions();
  } else {
    mapImage.addEventListener("load", applyDimensions);
  }
}

function fitMapToViewport() {
  const viewportRect = mapViewport.getBoundingClientRect();
  const vw = viewportRect.width;
  const vh = viewportRect.height;

  state.baseScale = Math.min(
    vw / state.naturalWidth,
    vh / state.naturalHeight
  );

  state.zoom = Math.max(state.minZoom, Math.min(state.zoom, state.maxZoom));

  const actualScale = state.baseScale * state.zoom;
  state.offsetX = (vw - state.naturalWidth * actualScale) / 2;
  state.offsetY = (vh - state.naturalHeight * actualScale) / 2;

  clampOffsets();
  applyTransform();
}

function applyTransform() {
  const actualScale = state.baseScale * state.zoom;
  mapStage.style.transform = `matrix(${actualScale}, 0, 0, ${actualScale}, ${state.offsetX}, ${state.offsetY})`;
}

function clampOffsets() {
  const viewportRect = mapViewport.getBoundingClientRect();
  const vw = viewportRect.width;
  const vh = viewportRect.height;
  const actualScale = state.baseScale * state.zoom;

  const scaledWidth = state.naturalWidth * actualScale;
  const scaledHeight = state.naturalHeight * actualScale;

  const minX = Math.min(0, vw - scaledWidth);
  const maxX = scaledWidth <= vw ? (vw - scaledWidth) / 2 : 0;

  const minY = Math.min(0, vh - scaledHeight);
  const maxY = scaledHeight <= vh ? (vh - scaledHeight) / 2 : 0;

  state.offsetX = Math.min(maxX, Math.max(minX, state.offsetX));
  state.offsetY = Math.min(maxY, Math.max(minY, state.offsetY));
}

function getDistance(p1, p2) {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.hypot(dx, dy);
}

function getMidpoint(p1, p2) {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
}

function screenToWorld(screenX, screenY) {
  const actualScale = state.baseScale * state.zoom;
  return {
    x: (screenX - state.offsetX) / actualScale,
    y: (screenY - state.offsetY) / actualScale,
  };
}

function zoomAtPoint(nextZoom, centerX, centerY) {
  const clampedZoom = Math.min(
    state.maxZoom,
    Math.max(state.minZoom, nextZoom)
  );

  const oldScale = state.baseScale * state.zoom;
  const newScale = state.baseScale * clampedZoom;

  const worldX = (centerX - state.offsetX) / oldScale;
  const worldY = (centerY - state.offsetY) / oldScale;

  state.zoom = clampedZoom;
  state.offsetX = centerX - worldX * newScale;
  state.offsetY = centerY - worldY * newScale;

  clampOffsets();
  applyTransform();
}

function onPointerDown(event) {
  if (event.target.closest(".mission-marker")) return;
  if (!mapViewport.contains(event.target)) return;

  mapViewport.setPointerCapture(event.pointerId);
  state.pointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });

  if (state.pointers.size === 1) {
    state.drag.active = true;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;
    state.drag.startOffsetX = state.offsetX;
    state.drag.startOffsetY = state.offsetY;
  }

  if (state.pointers.size === 2) {
    const [p1, p2] = [...state.pointers.values()];
    const midpoint = getMidpoint(p1, p2);
    const world = screenToWorld(midpoint.x, midpoint.y);

    state.pinch.startDistance = getDistance(p1, p2);
    state.pinch.startZoom = state.zoom;
    state.pinch.centerX = midpoint.x;
    state.pinch.centerY = midpoint.y;
    state.pinch.worldX = world.x;
    state.pinch.worldY = world.y;
    state.drag.active = false;
  }
}

function onPointerMove(event) {
  if (!state.pointers.has(event.pointerId)) return;

  state.pointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });

  if (state.pointers.size === 2) {
    const [p1, p2] = [...state.pointers.values()];
    const distance = getDistance(p1, p2);

    if (state.pinch.startDistance > 0) {
      const scaleRatio = distance / state.pinch.startDistance;
      const nextZoom = state.pinch.startZoom * scaleRatio;
      const clampedZoom = Math.min(
        state.maxZoom,
        Math.max(state.minZoom, nextZoom)
      );

      const newScale = state.baseScale * clampedZoom;
      state.zoom = clampedZoom;
      state.offsetX = state.pinch.centerX - state.pinch.worldX * newScale;
      state.offsetY = state.pinch.centerY - state.pinch.worldY * newScale;

      clampOffsets();
      applyTransform();
    }
    return;
  }

  if (state.pointers.size === 1 && state.drag.active) {
    state.offsetX =
      state.drag.startOffsetX + (event.clientX - state.drag.startX);
    state.offsetY =
      state.drag.startOffsetY + (event.clientY - state.drag.startY);

    clampOffsets();
    applyTransform();
  }
}

function onPointerUp(event) {
  state.pointers.delete(event.pointerId);

  if (state.pointers.size === 0) {
    state.drag.active = false;
    state.pinch.startDistance = 0;
  }

  if (state.pointers.size === 1) {
    const [remaining] = [...state.pointers.values()];
    state.drag.active = true;
    state.drag.startX = remaining.clientX;
    state.drag.startY = remaining.clientY;
    state.drag.startOffsetX = state.offsetX;
    state.drag.startOffsetY = state.offsetY;
  }
}

function setupMapInteractions() {
  mapViewport.addEventListener("pointerdown", onPointerDown);
  mapViewport.addEventListener("pointermove", onPointerMove);
  mapViewport.addEventListener("pointerup", onPointerUp);
  mapViewport.addEventListener("pointercancel", onPointerUp);
  mapViewport.addEventListener("pointerleave", onPointerUp);

  mapViewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.15 : -0.15;
      const nextZoom = state.zoom + delta;
      zoomAtPoint(nextZoom, event.clientX, event.clientY);
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    fitMapToViewport();
  });
}

function setupModalEvents() {
  missionStartBtn.addEventListener("click", () => {
    if (missionStartBtn.disabled) return;
    openQuizForActiveSpot();
  });

  missionCompleteBtn.addEventListener("click", async () => {
    if (missionCompleteBtn.disabled) return;
    await finishMissionForActiveSpot();
  });

  spotCloseBtn.addEventListener("click", closeSpotPopup);
  quizCloseBtn.addEventListener("click", closeQuizPopup);

  document.querySelectorAll("[data-close='spot']").forEach((el) => {
    el.addEventListener("click", closeSpotPopup);
  });

  document.querySelectorAll("[data-close='quiz']").forEach((el) => {
    el.addEventListener("click", closeQuizPopup);
  });

  choiceO.addEventListener("click", () => {
    setQuizResult(true);
  });

  choiceX.addEventListener("click", () => {
    setQuizResult(false);
  });
}

function buildKakaoState() {
  return `kakao:${crypto.randomUUID()}`;
}

function startKakaoLogin() {
  if (!kakao.restApiKey || !kakao.loginEndpoint) {
    setLoginHelp("카카오 설정값이 비어 있습니다.");
    showToast("카카오 설정값이 비어 있습니다.");
    return;
  }

  const stateToken = buildKakaoState();
  sessionStorage.setItem("kakao_oauth_state", stateToken);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: kakao.restApiKey,
    redirect_uri: kakao.redirectUri,
    state: stateToken,
  });

  setLoginHelp("카카오 로그인 페이지로 이동 중입니다...");
  window.location.href = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

async function handleKakaoCallbackIfNeeded() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    setLoginHelp(`카카오 로그인 실패: ${error}`);
    showToast("카카오 로그인에 실패했습니다.");
    cleanAuthQueryString();
    return;
  }

  if (!code || !stateParam || !stateParam.startsWith("kakao:")) {
    return;
  }

  const storedState = sessionStorage.getItem("kakao_oauth_state");
  if (!storedState || storedState !== stateParam) {
    setLoginHelp("카카오 로그인 상태값 검증에 실패했습니다.");
    showToast("카카오 로그인 상태값 검증에 실패했습니다.");
    cleanAuthQueryString();
    return;
  }

  setLoginHelp("카카오 로그인 처리 중입니다...");

  try {
    const response = await fetch(kakao.loginEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        redirectUri: kakao.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.customToken) {
      throw new Error("customToken missing");
    }

    await auth.signInWithCustomToken(data.customToken);
  } catch (err) {
    console.error("카카오 로그인 처리 실패:", err);
    setLoginHelp(`카카오 로그인 실패: ${err.message}`);
    showToast("카카오 로그인 처리에 실패했습니다.");
  } finally {
    sessionStorage.removeItem("kakao_oauth_state");
    cleanAuthQueryString();
  }
}

function cleanAuthQueryString() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function startGoogleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  setLoginHelp("Google 로그인 페이지로 이동 중입니다...");

  try {
    await auth.signInWithRedirect(provider);
  } catch (error) {
    console.error("Google 로그인 시작 실패:", error);
    setLoginHelp(`Google 로그인 실패: ${error.message}`);
    showToast("Google 로그인 시작에 실패했습니다.");
  }
}

async function startGuestLogin() {
  setLoginHelp("게스트 로그인 중입니다...");

  try {
    await auth.signInAnonymously();
  } catch (error) {
    console.error("게스트 로그인 실패:", error);
    setLoginHelp(`게스트 로그인 실패: ${error.message}`);
    showToast("게스트 로그인에 실패했습니다.");
  }
}

async function initAuth() {
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.error("Auth persistence 설정 실패:", error);
    setLoginHelp(`인증 저장 설정 실패: ${error.message}`);
  }

  googleLoginBtn.addEventListener("click", startGoogleLogin);
  kakaoLoginBtn.addEventListener("click", startKakaoLogin);
  guestLoginBtn.addEventListener("click", startGuestLogin);

  logoutBtn.addEventListener("click", async () => {
    try {
      await auth.signOut();
      showToast("로그아웃되었습니다.");
      setLoginHelp("로그인 후 이어서 플레이할 수 있습니다.");
    } catch (error) {
      console.error("로그아웃 실패:", error);
      showToast("로그아웃에 실패했습니다.");
    }
  });

  try {
    await auth.getRedirectResult();
  } catch (error) {
    console.error("Google redirect result 처리 실패:", error);
    setLoginHelp(`Google 로그인 실패: ${error.message}`);
    showToast("Google 로그인 처리에 실패했습니다.");
  }

  await handleKakaoCallbackIfNeeded();

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (!user) {
      loginScreen.classList.remove("hidden");
      setLoginHelp("로그인 후 이어서 플레이할 수 있습니다.");
      updateAccountUI(null);
      state.completed = [];
      renderMarkers();
      updateCounters();
      return;
    }

    loginScreen.classList.add("hidden");
    setLoginHelp("로그인되었습니다. 저장된 정보를 불러오는 중입니다...");
    updateAccountUI(user);
    await loadUserProgress();
  });
}

function init() {
  updateCounters();
  renderMarkers();
  setupMapDimensions();
  setupMapInteractions();
  setupModalEvents();
  setupGeolocation();
  updateGeoStatusText();
  initAuth();
}

init();