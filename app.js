const TOTAL_SPOTS = 31;
const STORAGE_KEY = "stamp-tour-progress-v1";

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
  completed: loadProgress(),
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

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => Number.isInteger(n));
  } catch (error) {
    return [];
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.completed));
}

function isCompleted(spotId) {
  return state.completed.includes(spotId);
}

function markCompleted(spotId) {
  if (isCompleted(spotId)) return;

  state.completed.push(spotId);
  saveProgress();
  updateCounters();
  refreshMarkerState(spotId, true);
}

function updateCounters() {
  const completed = state.completed.length;
  const remaining = TOTAL_SPOTS - completed;

  remainingCountEl.textContent = String(remaining);
  completedCountEl.textContent = `${completed} / ${TOTAL_SPOTS}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 1200);
}

function openModal(modalEl) {
  modalEl.classList.remove("hidden");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal(modalEl) {
  modalEl.classList.add("hidden");
  modalEl.setAttribute("aria-hidden", "true");
}

function closeSpotPopup() {
  closeModal(spotModal);
  state.activeSpotId = null;
}

function closeQuizPopup() {
  closeModal(quizModal);
  state.activeQuizSpotId = null;
  state.answeredCorrectly = false;
  missionCompleteBtn.disabled = true;
  quizResultArea.textContent = "";
  quizResultArea.className = "quiz-result-area";
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

  missionCompleteBtn.disabled = true;
  quizResultArea.textContent = "";
  quizResultArea.className = "quiz-result-area";

  closeModal(spotModal);
  openModal(quizModal);
}

function finishMissionForActiveSpot() {
  const spotId = state.activeQuizSpotId;
  if (!spotId || !state.answeredCorrectly) return;

  markCompleted(spotId);
  closeQuizPopup();
  showToast("도장이 찍혔습니다!");
  state.activeSpotId = null;
}

function setQuizResult(correct) {
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

  showToast(correct ? "정답입니다" : "오답입니다");

  clearTimeout(setQuizResult.timer);
  setQuizResult.timer = setTimeout(() => {
    quizResultArea.textContent = "";
    quizResultArea.className = "quiz-result-area";
  }, 1200);
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
  const clampedZoom = Math.min(state.maxZoom, Math.max(state.minZoom, nextZoom));

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

  missionCompleteBtn.addEventListener("click", () => {
    if (missionCompleteBtn.disabled) return;
    finishMissionForActiveSpot();
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

function init() {
  updateCounters();
  renderMarkers();
  setupMapDimensions();
  setupMapInteractions();
  setupModalEvents();
  setupGeolocation();
  updateGeoStatusText();
}

init();