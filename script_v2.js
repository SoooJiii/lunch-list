const API_URL = "https://script.google.com/macros/s/AKfycby61sHSYBk3RAFQt7Aqqs-rbuxVel8aq2ISsDom7viFzc0bh_LZi7DId8wrW4EHSne0/exec";

let allRestaurants = [];
let filteredRestaurants = [];

// DOM
const restaurantListEl = document.getElementById("restaurant-list");
const categoryFilterEl = document.getElementById("category-filter");
const tagFilterEl = document.getElementById("tag-filter");
const sortFilterEl = document.getElementById("sort-filter");
const randomButtonEl = document.getElementById("random-button");

const addFormEl = document.getElementById("add-restaurant-form");
const nameEl = document.getElementById("name");
const categoryEl = document.getElementById("category");
const priceEl = document.getElementById("price");
const commentEl = document.getElementById("comment");
const tagsEl = document.getElementById("tags");
const mapUrlEl = document.getElementById("naverMapUrl");
const createdByEl = document.getElementById("createdBy");

// 초기 실행
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await loadRestaurants();
});

// 이벤트 연결
function bindEvents() {
  if (categoryFilterEl) {
    categoryFilterEl.addEventListener("change", applyFilters);
  }

  if (tagFilterEl) {
    tagFilterEl.addEventListener("input", applyFilters);
  }

  if (sortFilterEl) {
    sortFilterEl.addEventListener("change", applyFilters);
  }

  if (randomButtonEl) {
    randomButtonEl.addEventListener("click", pickRandomRestaurant);
  }

  if (addFormEl) {
    addFormEl.addEventListener("submit", handleAddRestaurant);
  }
}

// 데이터 로드
async function loadRestaurants() {
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
    applyFilters();
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    if (restaurantListEl) {
      restaurantListEl.innerHTML = `<p>데이터를 불러오지 못했어 😢</p>`;
    }
  }
}

// 맛집 + 평점 합치기
function mergeRestaurantAndRatings(restaurants, ratings) {
  return restaurants.map((restaurant) => {
    const relatedRatings = ratings.filter(
      (rating) => String(rating.restaurantId) === String(restaurant.id)
    );

    const ratingNumbers = relatedRatings
      .map((rating) => Number(rating.rating))
      .filter((num) => !isNaN(num) && num > 0);

    const avgRating =
      ratingNumbers.length > 0
        ? (ratingNumbers.reduce((sum, cur) => sum + cur, 0) / ratingNumbers.length).toFixed(1)
        : "0.0";

    return {
      ...restaurant,
      price: Number(restaurant.price) || 0,
      avgRating: Number(avgRating),
      ratingCount: ratingNumbers.length,
      ratings: relatedRatings
    };
  });
}

// 카테고리 필터 채우기
function populateCategoryFilter(data) {
  if (!categoryFilterEl) return;

  const currentValue = categoryFilterEl.value;
  const categories = [...new Set(data.map((item) => item.category).filter(Boolean))];

  categoryFilterEl.innerHTML = `<option value="">전체 카테고리</option>`;

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilterEl.appendChild(option);
  });

  if ([...categoryFilterEl.options].some((opt) => opt.value === currentValue)) {
    categoryFilterEl.value = currentValue;
  }
}

// 필터 + 정렬 적용
function applyFilters() {
  let result = [...allRestaurants];

  const selectedCategory = categoryFilterEl ? categoryFilterEl.value.trim() : "";
  const tagKeyword = tagFilterEl ? tagFilterEl.value.trim().toLowerCase() : "";
  const sortValue = sortFilterEl ? sortFilterEl.value : "";

  // 카테고리 필터
  if (selectedCategory) {
    result = result.filter((item) => item.category === selectedCategory);
  }

  // 태그 필터
  if (tagKeyword) {
    result = result.filter((item) => {
      const tags = String(item.tags || "").toLowerCase();
      return tags.includes(tagKeyword);
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
    case "ratingDesc":
      result.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case "ratingCountDesc":
      result.sort((a, b) => b.ratingCount - a.ratingCount);
      break;
    case "nameAsc":
      result.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
      break;
    default:
      // 기본은 id 오름차순
      result.sort((a, b) => Number(a.id) - Number(b.id));
      break;
  }

  filteredRestaurants = result;
  renderRestaurants(filteredRestaurants);
}

// 목록 렌더링
function renderRestaurants(data) {
  if (!restaurantListEl) return;

  if (!data.length) {
    restaurantListEl.innerHTML = `<p>조건에 맞는 맛집이 없어 😢</p>`;
    return;
  }

  const html = data
    .map((item) => {
      const safeMapUrl = escapeHtml(item.naverMapUrl || "");
      const safeName = escapeHtml(item.name || "");
      const safeCategory = escapeHtml(item.category || "");
      const safeComment = escapeHtml(item.comment || "");
      const safeTags = escapeHtml(item.tags || "");
      const safeCreatedBy = escapeHtml(item.createdBy || "익명");

      return `
        <div class="restaurant-card">
          <div class="restaurant-header">
            <h3>${safeName}</h3>
            <div class="restaurant-meta">
              <span class="badge">${safeCategory}</span>
              <span class="badge">₩ ${formatNumber(item.price)}</span>
            </div>
          </div>

          <p class="restaurant-comment">${safeComment}</p>

          <p class="restaurant-tags">
            <strong>태그:</strong> ${safeTags || "-"}
          </p>

          <p class="restaurant-rating-summary">
            <strong>평균 평점:</strong> ${renderStaticStars(item.avgRating)}
            <span>${item.avgRating.toFixed(1)} / 5</span>
            <span>(${item.ratingCount}명)</span>
          </p>

          <div class="rating-input-area">
            <span><strong>평점 남기기:</strong></span>
            <div class="star-buttons">
              ${renderRatingButtons(item.id)}
            </div>
          </div>

          ${
            safeMapUrl
              ? `<p><a href="${safeMapUrl}" target="_blank" rel="noopener noreferrer">네이버지도 보기</a></p>`
              : ""
          }

          <p class="restaurant-created-by">
            <small>등록자: ${safeCreatedBy}</small>
          </p>

          <details class="rating-history">
            <summary>후기 보기 (${item.ratings.length})</summary>
            ${renderRatingHistory(item.ratings)}
          </details>
        </div>
      `;
    })
    .join("");

  restaurantListEl.innerHTML = html;
}

// 고정 별 표시
function renderStaticStars(avgRating) {
  const rounded = Math.round(avgRating);
  let stars = "";

  for (let i = 1; i <= 5; i++) {
    stars += i <= rounded ? "★" : "☆";
  }

  return `<span class="static-stars">${stars}</span>`;
}

// 클릭용 별 버튼
function renderRatingButtons(restaurantId) {
  let html = "";

  for (let i = 1; i <= 5; i++) {
    html += `
      <button type="button" class="star-button" onclick="submitRating(${restaurantId}, ${i})">
        ${i}★
      </button>
    `;
  }

  return html;
}

// 후기 목록 렌더링
function renderRatingHistory(ratings) {
  if (!ratings || !ratings.length) {
    return `<p>아직 후기가 없어.</p>`;
  }

  const html = ratings
    .slice()
    .reverse()
    .map((rating) => {
      const createdBy = escapeHtml(rating.createdBy || "익명");
      const memo = escapeHtml(rating.memo || "");
      const score = Number(rating.rating) || 0;
      const createdAt = formatDate(rating.createdAt);

      return `
        <div class="rating-item">
          <p><strong>${"★".repeat(score)}${"☆".repeat(5 - score)}</strong></p>
          <p>${memo || "-"}</p>
          <p><small>${createdBy} · ${createdAt}</small></p>
        </div>
      `;
    })
    .join("");

  return `<div class="rating-list">${html}</div>`;
}

// 랜덤 추천
function pickRandomRestaurant() {
  if (!filteredRestaurants.length) {
    alert("추천할 맛집이 없어!");
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredRestaurants.length);
  const picked = filteredRestaurants[randomIndex];

  alert(
    `오늘의 추천 맛집 🍽️\n\n` +
      `이름: ${picked.name}\n` +
      `카테고리: ${picked.category}\n` +
      `가격: ₩ ${formatNumber(picked.price)}\n` +
      `평균평점: ${picked.avgRating.toFixed(1)} (${picked.ratingCount}명)\n` +
      `설명: ${picked.comment || "-"}`
  );
}

// 맛집 추가
async function handleAddRestaurant(e) {
  e.preventDefault();

  const name = nameEl ? nameEl.value.trim() : "";
  const category = categoryEl ? categoryEl.value.trim() : "";
  const price = priceEl ? priceEl.value.trim() : "";
  const comment = commentEl ? commentEl.value.trim() : "";
  const tags = tagsEl ? tagsEl.value.trim() : "";
  const naverMapUrl = mapUrlEl ? mapUrlEl.value.trim() : "";
  const createdBy = createdByEl ? createdByEl.value.trim() : "";

  if (!name) {
    alert("가게 이름은 꼭 입력해줘!");
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
      alert("맛집 추가 실패: " + (result.message || "알 수 없는 오류"));
      return;
    }

    alert("맛집 추가 완료!");
    addFormEl.reset();
    await loadRestaurants();
  } catch (error) {
    console.error("맛집 추가 실패:", error);
    alert("맛집 추가 중 오류가 발생했어.");
  }
}

// 평점 추가
async function submitRating(restaurantId, rating) {
  const createdBy = prompt("이름을 입력해줘! (취소하면 익명)");
  const memo = prompt("한줄 후기 남길래? (취소해도 됨)");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addRating",
        restaurantId,
        rating,
        memo: memo || "",
        createdBy: createdBy || "익명"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert("평점 등록 실패: " + (result.message || "알 수 없는 오류"));
      return;
    }

    alert("평점 등록 완료!");
    await loadRestaurants();
  } catch (error) {
    console.error("평점 등록 실패:", error);
    alert("평점 등록 중 오류가 발생했어.");
  }
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
