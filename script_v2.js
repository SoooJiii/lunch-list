const API_URL = "여기에_네_앱스스크립트_웹앱_URL_넣기";

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
const restaurantCardTemplate = document.getElementById("restaurantCardTemplate");

// 시작
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await loadData();
});

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
    const [restaurantRes, ratingRes] = await Promise.all([
      fetch(`${API_URL}?action=getRestaurants`),
      fetch(`${API_URL}?action=getRatings`)
    ]);

    const restaurantJson = await restaurantRes.json();
    const ratingJson = await ratingRes.json();

    const restaurants = Array.isArray(restaurantJson.data) ? restaurantJson.data : [];
    const ratings = Array.isArray(ratingJson.data) ? ratingJson.data : [];

    allRestaurants = mergeRestaurantAndRatings(restaurants, ratings);

    populateCategoryFilter(allRestaurants);
    renderTagFilters(allRestaurants);
    applyFilters();
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    restaurantList.innerHTML = `<p>데이터를 불러오지 못했어 😢</p>`;
    emptyState.classList.add("hidden");
  }
}

// 맛집 + 평점 합치기
function mergeRestaurantAndRatings(restaurants, ratings) {
  return restaurants.map((restaurant) => {
    const relatedRatings = ratings.filter(
      (rating) => String(rating.restaurantId) === String(restaurant.id)
    );

    const validScores = relatedRatings
      .map((rating) => Number(rating.rating))
      .filter((score) => !isNaN(score) && score >= 1 && score <= 5);

    const avgRating = validScores.length
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    return {
      ...restaurant,
      id: Number(restaurant.id) || restaurant.id,
      name: String(restaurant.name || "").trim(),
      category: String(restaurant.category || "").trim(),
      price: Number(restaurant.price) || 0,
      comment: String(restaurant.comment || "").trim(),
      tags: String(restaurant.tags || "").trim(),
      naverMapUrl: String(restaurant.naverMapUrl || "").trim(),
      createdBy: String(restaurant.createdBy || "익명").trim(),
      tagArray: parseTags(restaurant.tags),
      ratings: relatedRatings,
      ratingCount: validScores.length,
      avgRating
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
  const categories = [...new Set(data.map((item) => item.category).filter(Boolean))];

  categoryFilter.innerHTML = `<option value="all">전체</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  if ([...categoryFilter.options].some((option) => option.value === currentValue)) {
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

    cardTitle.textContent = restaurant.name || "-";
    cardCategory.textContent = restaurant.category || "카테고리 없음";
    cardPrice.textContent = restaurant.price ? `₩ ${formatNumber(restaurant.price)}` : "가격 정보 없음";
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
      button.addEventListener("click", () => handleRateRestaurant(restaurant.id, i));
      ratingButtons.appendChild(button);
    }

    // 후기
    reviewSummary.textContent = `후기 보기 (${restaurant.ratings.length})`;
    reviewList.innerHTML = "";

    if (restaurant.ratings.length === 0) {
      const emptyReview = document.createElement("p");
      emptyReview.className = "review-empty";
      emptyReview.textContent = "아직 후기가 없어.";
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

          item.innerHTML = `
            <p class="review-stars">${"★".repeat(score)}${"☆".repeat(5 - score)}</p>
            <p class="review-memo">${memo || "한줄 후기는 없음"}</p>
            <p class="review-meta">${writer} · ${date}</p>
          `;

          reviewList.appendChild(item);
        });
    }

    // 지도 링크
    if (restaurant.naverMapUrl) {
      mapLink.href = restaurant.naverMapUrl;
      mapLink.style.display = "";
    } else {
      mapLink.removeAttribute("href");
      mapLink.style.display = "none";
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
    alert("추천할 맛집이 없어 😢");
    return;
  }

  const picked = filteredRestaurants[Math.floor(Math.random() * filteredRestaurants.length)];

  randomName.textContent = picked.name || "이름 없음";
  randomMeta.textContent = `${picked.category || "카테고리 없음"} · ₩ ${formatNumber(picked.price)} · 평점 ${picked.avgRating.toFixed(1)} (${picked.ratingCount}명)`;
  randomComment.textContent = picked.comment || "설명 없음";

  if (picked.naverMapUrl) {
    randomMapLink.href = picked.naverMapUrl;
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
  const naverMapUrl = mapUrlInput.value.trim();

  if (!name) {
    alert("가게 이름은 꼭 입력해줘!");
    nameInput.focus();
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addRestaurant",
        name,
        category,
        price,
        comment,
        tags,
        naverMapUrl,
        createdBy: createdBy || "익명"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(`맛집 추가 실패: ${result.message || "알 수 없는 오류"}`);
      return;
    }

    alert("맛집 추가 완료!");
    addRestaurantForm.reset();
    await loadData();
  } catch (error) {
    console.error("맛집 추가 실패:", error);
    alert("맛집 추가 중 오류가 발생했어.");
  }
}

// 평점 등록
async function handleRateRestaurant(restaurantId, rating) {
  const createdBy = prompt("이름을 입력해줘! (취소하면 익명)") || "익명";
  const memoInput = prompt("한줄 후기를 남길래? (취소하면 빈칸)");

  const memo = memoInput === null ? "" : memoInput.trim();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addRating",
        restaurantId,
        rating,
        memo,
        createdBy
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(`평점 등록 실패: ${result.message || "알 수 없는 오류"}`);
      return;
    }

    alert("평점 등록 완료!");
    await loadData();
  } catch (error) {
    console.error("평점 등록 실패:", error);
    alert("평점 등록 중 오류가 발생했어.");
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
