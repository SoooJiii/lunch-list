const loadingOverlay = document.getElementById("loadingOverlay");
const API_URL =
  "https://script.google.com/macros/s/AKfycbzZFkYz0eW31RL7eEp6VGLrYv74g9W4Nbb5RP2XnN70CYQ-gUzzpVn_gBlYvLxeRA3o/exec";

let allRestaurants = [];
let filteredRestaurants = [];
let selectedTags = new Set();

// DOM
const randomBtn = document.getElementById("randomBtn");
const randomResult = document.getElementById("randomResult");
const randomName = document.getElementById("randomName");
const randomMeta = document.getElementById("randomMeta");
const randomComment = document.getElementById("randomComment");
const randomMapLink = document.getElementById("randomMapLink");

const addRestaurantForm = document.getElementById("addRestaurantForm");
const nameInput = document.getElementById("nameInput");
const categoryInput = document.getElementById("categoryInput");
const priceInput = document.getElementById("priceInput");
const createdByInput = document.getElementById("createdByInput");
const commentInput = document.getElementById("commentInput");
const tagsInput = document.getElementById("tagsInput");
const mapUrlInput = document.getElementById("mapUrlInput");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const tagFilters = document.getElementById("tagFilters");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const resultCount = document.getElementById("resultCount");
const activeFilterText = document.getElementById("activeFilterText");

const restaurantList = document.getElementById("restaurantList");
const emptyState = document.getElementById("emptyState");
const restaurantCardTemplate = document.getElementById(
  "restaurantCardTemplate",
);

const CACHE_KEY = "lunch_restaurant_cache_v1";

const ratingModalState = {
  mode: "create", // "create" | "edit"
  restaurantId: null,
  reviewId: null,
};

// 시작
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  initRatingModal();
  const cachedData = loadRestaurantCache();

  if (cachedData && cachedData.length > 0) {
    allRestaurants = cachedData;
    populateCategoryFilter(allRestaurants);
    renderTagFilters(allRestaurants);
    applyFilters();

    // 캐시가 있으면 조용히 최신 데이터 갱신
    loadDataSilently();
  } else {
    // 캐시가 없을 때만 로딩 보이기
    await loadData();
  }
});

function openRatingModalForCreate(restaurantId, rating = 5) {
  ratingModalState.mode = "create";
  ratingModalState.restaurantId = normalizeId(restaurantId);
  ratingModalState.reviewId = null;

  document.getElementById("ratingModalTitle").textContent = "평점 남기기";
  document.getElementById("ratingSubmitBtn").textContent = "등록";

  document.getElementById("ratingCreatedBy").value = "";
  document.getElementById("ratingCreatedBy").disabled = false;
  document.getElementById("ratingScore").value = String(rating);
  document.getElementById("ratingMemo").value = "";
  document.getElementById("ratingPassword").value = "";
  document.getElementById("ratingModalError").textContent = "";

  document.getElementById("ratingModal").classList.remove("hidden");
}

function openRatingModalForEdit(review) {
  ratingModalState.mode = "edit";
  ratingModalState.restaurantId = normalizeId(review.restaurantId);
  ratingModalState.reviewId = normalizeId(review.id);

  document.getElementById("ratingModalTitle").textContent = "평점 수정하기";
  document.getElementById("ratingSubmitBtn").textContent = "수정";

  document.getElementById("ratingCreatedBy").value = review.createdBy || "익명";
  document.getElementById("ratingCreatedBy").disabled = true;
  document.getElementById("ratingScore").value = String(
    Number(review.rating) || 5,
  );
  document.getElementById("ratingMemo").value = review.memo || "";
  document.getElementById("ratingPassword").value = "";
  document.getElementById("ratingModalError").textContent = "";

  document.getElementById("ratingModal").classList.remove("hidden");
}

function closeRatingModal() {
  document.getElementById("ratingModal").classList.add("hidden");
}
async function handleRatingModalSubmit() {
  const createdByInput = document
    .getElementById("ratingCreatedBy")
    .value.trim();
  const createdBy = createdByInput || "익명";
  const rating = Number(document.getElementById("ratingScore").value);
  const memo = document.getElementById("ratingMemo").value.trim();
  const password = document.getElementById("ratingPassword").value.trim();
  const errorEl = document.getElementById("ratingModalError");

  errorEl.textContent = "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errorEl.textContent = "평점은 1~5 사이로 선택해주세요.";
    return;
  }

  if (!/^\d{4}$/.test(password)) {
    errorEl.textContent = "비밀번호는 숫자 4자리로 입력해주세요.";
    return;
  }

  try {
    showLoading(
      ratingModalState.mode === "create"
        ? "평점 등록하는 중..."
        : "평점 수정하는 중...",
    );

    let body;

    if (ratingModalState.mode === "create") {
      body = {
        action: "addRating",
        restaurantId: ratingModalState.restaurantId,
        rating,
        memo,
        createdBy,
        password,
      };
    } else {
      body = {
        action: "updateRating",
        id: ratingModalState.reviewId,
        rating,
        memo,
        password,
      };
    }

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!result.success) {
      errorEl.textContent = result.message || "처리에 실패했어요.";
      return;
    }

    closeRatingModal();
    await loadData();
    alert(
      ratingModalState.mode === "create"
        ? "평점 등록 완료!"
        : "평점 수정 완료!",
    );
  } catch (error) {
    console.error("평점 처리 실패:", error);
    errorEl.textContent = "처리 중 오류가 발생했어요.";
  } finally {
    hideLoading();
  }
}

function initRatingModal() {
  document
    .getElementById("ratingSubmitBtn")
    .addEventListener("click", handleRatingModalSubmit);

  document.querySelectorAll("[data-close='ratingModal']").forEach((el) => {
    el.addEventListener("click", closeRatingModal);
  });
}

async function loadDataSilently() {
  try {
    const response = await fetch(`${API_URL}?action=getAllData`, {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();

    const restaurants = Array.isArray(result.restaurants)
      ? result.restaurants
      : [];
    const ratings = Array.isArray(result.ratings) ? result.ratings : [];

    allRestaurants = mergeRestaurantAndRatings(restaurants, ratings);

    saveRestaurantCache(allRestaurants);

    populateCategoryFilter(allRestaurants);
    renderTagFilters(allRestaurants);
    applyFilters();
  } catch (error) {
    console.error("조용한 데이터 갱신 실패:", error);
  }
}

function saveRestaurantCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch (error) {
    console.warn("캐시 저장 실패:", error);
  }
}

function loadRestaurantCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;

    return parsed.data;
  } catch (error) {
    console.warn("캐시 불러오기 실패:", error);
    return null;
  }
}

function showLoading(message = "맛집 리스트 불러오는 중...") {
  if (!loadingOverlay) return;

  const text = loadingOverlay.querySelector("p");
  if (text) {
    text.textContent = message;
  }

  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add("hidden");
}
// 이벤트 연결
function bindEvents() {
  if (randomBtn) {
    randomBtn.addEventListener("click", handleRandomPick);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", applyFilters);
  }

  if (sortFilter) {
    sortFilter.addEventListener("change", applyFilters);
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", resetFilters);
  }

  if (addRestaurantForm) {
    addRestaurantForm.addEventListener("submit", handleAddRestaurant);
  }
}

// 데이터 로드
async function loadData() {
  try {
    showLoading("맛집 리스트 불러오는 중...");

    const response = await fetch(`${API_URL}?action=getAllData`, {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();

    const restaurants = Array.isArray(result.restaurants)
      ? result.restaurants
      : [];
    const ratings = Array.isArray(result.ratings) ? result.ratings : [];

    allRestaurants = mergeRestaurantAndRatings(restaurants, ratings);
    saveRestaurantCache(allRestaurants);

    populateCategoryFilter(allRestaurants);
    renderTagFilters(allRestaurants);
    applyFilters();
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    restaurantList.innerHTML = `<p>데이터를 불러오지 못했어요 😢</p>`;
    emptyState.classList.add("hidden");
  } finally {
    hideLoading();
  }
}

// 맛집 + 평점 합치기
function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.0$/, "");
}

function mergeRestaurantAndRatings(restaurants, ratings) {
  return restaurants.map((restaurant) => {
    const restaurantId = normalizeId(restaurant.id);

    const relatedRatings = ratings.filter((rating) => {
      return normalizeId(rating.restaurantId) === restaurantId;
    });

    const validScores = relatedRatings
      .map((rating) => Number(rating.rating))
      .filter((score) => !isNaN(score) && score >= 1 && score <= 5);

    const avgRating = validScores.length
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    return {
      ...restaurant,
      id: restaurantId,
      name: String(restaurant.name || "").trim(),
      category: String(restaurant.category || "").trim(),
      price: Number(restaurant.price) || 0,
      comment: String(restaurant.comment || "").trim(),
      tags: String(restaurant.tags || "").trim(),
      naverURL: String(restaurant.naverURL || "").trim(),
      createdBy: String(restaurant.createdBy || "익명").trim(),
      tagArray: parseTags(restaurant.tags),
      ratings: relatedRatings,
      ratingCount: validScores.length,
      avgRating,
    };
  });
}

// 태그 파싱
function parseTags(tags) {
  if (!tags) return [];
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// 카테고리 필터 채우기
function populateCategoryFilter(data) {
  const currentValue = categoryFilter.value;
  const categories = [
    ...new Set(data.map((item) => item.category).filter(Boolean)),
  ];

  categoryFilter.innerHTML = `<option value="all">전체</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  if (
    [...categoryFilter.options].some((option) => option.value === currentValue)
  ) {
    categoryFilter.value = currentValue;
  }
}

// 태그 필터 렌더링
function renderTagFilters(data) {
  const allTags = [...new Set(data.flatMap((item) => item.tagArray))];

  tagFilters.innerHTML = "";

  allTags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-chip";
    button.textContent = tag;

    if (selectedTags.has(tag)) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
      } else {
        selectedTags.add(tag);
      }

      renderTagFilters(allRestaurants);
      applyFilters();
    });

    tagFilters.appendChild(button);
  });
}

// 필터 적용
function applyFilters() {
  const searchKeyword = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const sortValue = sortFilter.value;

  let result = [...allRestaurants];

  // 검색
  if (searchKeyword) {
    result = result.filter((item) => {
      const name = item.name.toLowerCase();
      const comment = item.comment.toLowerCase();
      const tags = item.tags.toLowerCase();
      return (
        name.includes(searchKeyword) ||
        comment.includes(searchKeyword) ||
        tags.includes(searchKeyword)
      );
    });
  }

  // 카테고리
  if (selectedCategory !== "all") {
    result = result.filter((item) => item.category === selectedCategory);
  }

  // 태그
  if (selectedTags.size > 0) {
    result = result.filter((item) => {
      return [...selectedTags].every((tag) => item.tagArray.includes(tag));
    });
  }

  // 정렬
  switch (sortValue) {
    case "priceAsc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "priceDesc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "nameAsc":
      result.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
    case "ratingDesc":
      result.sort((a, b) => {
        if (b.avgRating === a.avgRating) return b.ratingCount - a.ratingCount;
        return b.avgRating - a.avgRating;
      });
      break;
    case "ratingCountDesc":
      result.sort((a, b) => {
        if (b.ratingCount === a.ratingCount) return b.avgRating - a.avgRating;
        return b.ratingCount - a.ratingCount;
      });
      break;
    case "default":
    default:
      result.sort((a, b) => Number(a.id) - Number(b.id));
      break;
  }

  filteredRestaurants = result;
  updateSummary();
  renderRestaurants(filteredRestaurants);
}

// 카드 렌더링
function renderRestaurants(data) {
  restaurantList.innerHTML = "";

  if (!data.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  data.forEach((restaurant) => {
    const fragment = restaurantCardTemplate.content.cloneNode(true);

    const cardTitle = fragment.querySelector(".card-title");
    const cardCategory = fragment.querySelector(".card-category");
    const cardPrice = fragment.querySelector(".card-price");
    const cardComment = fragment.querySelector(".card-comment");
    const cardTags = fragment.querySelector(".card-tags");
    const staticStars = fragment.querySelector(".static-stars");
    const ratingScore = fragment.querySelector(".rating-score");
    const ratingButtons = fragment.querySelector(".rating-buttons");
    const reviewSummary = fragment.querySelector(".review-summary");
    const reviewList = fragment.querySelector(".review-list");
    const cardCreatedBy = fragment.querySelector(".card-created-by");
    const mapLink = fragment.querySelector(".map-link");

    cardTitle.innerHTML = "";

    const titleText = document.createElement("span");
    titleText.textContent = restaurant.name || "-";
    cardTitle.appendChild(titleText);

    if (restaurant.naverURL) {
      mapLink.href = restaurant.naverURL;
      mapLink.style.display = "";
      mapLink.textContent = "📍";
      mapLink.setAttribute("target", "_blank");
      mapLink.setAttribute("rel", "noopener noreferrer");
      mapLink.classList.add("map-link-inline");

      cardTitle.appendChild(mapLink);
    } else {
      mapLink.removeAttribute("href");
      mapLink.style.display = "none";
    }

    cardCategory.textContent = restaurant.category || "카테고리 없음";
    cardPrice.textContent = restaurant.price
      ? `₩ ${formatNumber(restaurant.price)}`
      : "가격 정보 없음";
    cardComment.textContent = restaurant.comment || "설명 없음";
    cardCreatedBy.textContent = `등록자: ${restaurant.createdBy || "익명"}`;

    staticStars.textContent = makeStars(restaurant.avgRating);
    ratingScore.textContent = `${restaurant.avgRating.toFixed(1)} / 5 (${restaurant.ratingCount}명)`;

    // 태그
    cardTags.innerHTML = "";
    if (restaurant.tagArray.length > 0) {
      restaurant.tagArray.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = `#${tag}`;
        cardTags.appendChild(span);
      });
    } else {
      const emptyTag = document.createElement("span");
      emptyTag.className = "tag empty";
      emptyTag.textContent = "#태그없음";
      cardTags.appendChild(emptyTag);
    }

    // 평점 버튼
    ratingButtons.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "star-rate-btn";
      button.textContent = `${i}★`;
      button.addEventListener("click", () =>
        handleRateRestaurant(restaurant.id, i),
      );
      ratingButtons.appendChild(button);
    }

    // 후기
    reviewSummary.textContent = `후기 보기 (${restaurant.ratings.length})`;
    reviewList.innerHTML = "";

    if (restaurant.ratings.length === 0) {
      const emptyReview = document.createElement("p");
      emptyReview.className = "review-empty";
      emptyReview.textContent = "아직 후기가 없어요.";
      reviewList.appendChild(emptyReview);
    } else {
      restaurant.ratings
        .slice()
        .sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime() || 0;
          const dateB = new Date(b.createdAt).getTime() || 0;
          return dateB - dateA;
        })
        .forEach((review) => {
          const item = document.createElement("div");
          item.className = "review-item";

          const writer = escapeHtml(review.createdBy || "익명");
          const memo = escapeHtml(review.memo || "");
          const score = Number(review.rating) || 0;
          const date = formatDate(review.createdAt);
          const canEdit = review.password && review.password !== "locked";

          item.innerHTML = `
  <div class="review-top">
    <p class="review-stars">${"★".repeat(score)}${"☆".repeat(5 - score)}</p>

    ${
      canEdit
        ? `
        <div class="review-actions">
          <button type="button" class="review-edit-btn">수정</button>
          <button type="button" class="review-delete-btn">삭제</button>
        </div>
      `
        : ""
    }
  </div>

  <p class="review-memo">${memo || "한줄 후기는 없음"}</p>

  <div class="review-bottom">
    <p class="review-meta">${writer} · ${date}</p>
  </div>
`;

          if (canEdit) {
            const editButton = item.querySelector(".review-edit-btn");
            editButton.addEventListener("click", () =>
              handleEditRating(review),
            );

            const deleteButton = item.querySelector(".review-delete-btn");
            deleteButton.addEventListener("click", () =>
              handleDeleteRating(review),
            );
          }

          reviewList.appendChild(item);
        });
    }

    restaurantList.appendChild(fragment);
  });
}

// 요약 바 업데이트
function updateSummary() {
  resultCount.textContent = `총 ${filteredRestaurants.length}곳`;

  const searchKeyword = searchInput.value.trim();
  const selectedCategory = categoryFilter.value;
  const tags = [...selectedTags];

  const parts = [];

  if (searchKeyword) {
    parts.push(`"${searchKeyword}" 검색`);
  }

  if (selectedCategory !== "all") {
    parts.push(`${selectedCategory} 카테고리`);
  }

  if (tags.length > 0) {
    parts.push(`태그 ${tags.map((tag) => `#${tag}`).join(", ")}`);
  }

  if (parts.length === 0) {
    activeFilterText.textContent = "전체 맛집을 보여주는 중";
  } else {
    activeFilterText.textContent = `${parts.join(" / ")} 조건으로 보는 중`;
  }
}

// 랜덤 추천
function handleRandomPick() {
  if (!filteredRestaurants.length) {
    alert("추천할 맛집이 없어요 😢");
    return;
  }

  const picked =
    filteredRestaurants[Math.floor(Math.random() * filteredRestaurants.length)];

  randomName.textContent = picked.name || "이름 없음";
  randomMeta.textContent = `${picked.category || "카테고리 없음"} · ₩ ${formatNumber(picked.price)} · 평점 ${picked.avgRating.toFixed(1)} (${picked.ratingCount}명)`;
  randomComment.textContent = picked.comment || "설명 없음";

  if (picked.naverURL) {
    randomMapLink.href = picked.naverURL;
    randomMapLink.style.display = "";
  } else {
    randomMapLink.removeAttribute("href");
    randomMapLink.style.display = "none";
  }

  randomResult.classList.remove("hidden");
  randomResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 필터 초기화
function resetFilters() {
  searchInput.value = "";
  categoryFilter.value = "all";
  sortFilter.value = "default";
  selectedTags.clear();

  renderTagFilters(allRestaurants);
  applyFilters();
}

// 맛집 추가
async function handleAddRestaurant(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const price = priceInput.value.trim();
  const createdBy = createdByInput.value.trim();
  const comment = commentInput.value.trim();
  const tags = tagsInput.value.trim();
  const naverURL = mapUrlInput.value.trim();

  if (!name) {
    alert("가게 이름은 꼭 입력해주세요!");
    nameInput.focus();
    return;
  }

  try {
    showLoading("맛집 추가하는 중...");

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addRestaurant",
        name,
        category,
        price,
        comment,
        tags,
        naverURL,
        createdBy: createdBy || "익명",
      }),
    });

    const result = await response.json();

    if (!result.success) {
      alert(`맛집 추가 실패: ${result.message || "알 수 없는 오류"}`);
      return;
    }

    addRestaurantForm.reset();
    await loadData();
    alert("맛집 추가 완료!");
  } catch (error) {
    console.error("맛집 추가 실패:", error);
    alert("맛집 추가 중 오류가 발생했어요.");
  } finally {
    hideLoading();
  }
}

// 평점 등록
function handleRateRestaurant(restaurantId, rating) {
  openRatingModalForCreate(restaurantId, rating);
}

// 평점 수정
function handleEditRating(review) {
  if (!review || !review.id) {
    alert("수정할 후기를 찾을 수 없어요.");
    return;
  }

  openRatingModalForEdit(review);
}

// 평점 삭제
async function handleDeleteRating(review) {
  if (!review || !review.id) {
    alert("삭제할 후기를 찾을 수 없어요.");
    return;
  }

  const passwordInput = prompt("삭제용 비밀번호 4자리를 입력해주세요.");
  if (passwordInput === null) {
    return;
  }

  const password = passwordInput.trim();

  if (!/^\d{4}$/.test(password)) {
    alert("비밀번호는 숫자 4자리로 입력해주세요.");
    return;
  }

  const confirmed = confirm("정말 이 후기를 삭제할까요?");
  if (!confirmed) {
    return;
  }

  try {
    showLoading("평점 삭제하는 중...");

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteRating",
        id: normalizeId(review.id),
        password,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      alert(`평점 삭제 실패: ${result.message || "알 수 없는 오류"}`);
      return;
    }

    await loadData();
    alert("평점 삭제 완료!");
  } catch (error) {
    console.error("평점 삭제 실패:", error);
    alert("평점 삭제 중 오류가 발생했어요.");
  } finally {
    hideLoading();
  }
}

// 별 문자열
function makeStars(avgRating) {
  const rounded = Math.round(avgRating);
  let stars = "";

  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? "★" : "☆";
  }

  return stars;
}

// 숫자 포맷
function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("ko-KR");
}

// 날짜 포맷
function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// XSS 방지용
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
