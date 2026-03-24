const state = {
  restaurants: [],
  selectedTags: new Set(),
  searchKeyword: "",
  selectedCategory: "all",
  selectedSort: "default"
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  sortFilter: document.getElementById("sortFilter"),
  tagFilters: document.getElementById("tagFilters"),
  restaurantList: document.getElementById("restaurantList"),
  resultCount: document.getElementById("resultCount"),
  activeFilterText: document.getElementById("activeFilterText"),
  emptyState: document.getElementById("emptyState"),
  randomBtn: document.getElementById("randomBtn"),
  randomResult: document.getElementById("randomResult"),
  randomName: document.getElementById("randomName"),
  randomMeta: document.getElementById("randomMeta"),
  randomComment: document.getElementById("randomComment"),
  randomMapLink: document.getElementById("randomMapLink"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  cardTemplate: document.getElementById("restaurantCardTemplate")
};

async function init() {
  try {
    const response = await fetch("restaurants.json");
    if (!response.ok) throw new Error("데이터를 불러오지 못했습니다.");

    state.restaurants = await response.json();
    renderCategoryOptions();
    renderTagFilters();
    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    elements.emptyState.classList.remove("hidden");
    elements.emptyState.innerHTML = `
      <p>맛집 데이터를 불러오지 못했어 😢</p>
      <p>파일 경로나 JSON 형식을 확인해줘!</p>
    `;
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchKeyword = event.target.value.trim().toLowerCase();
    render();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    state.selectedCategory = event.target.value;
    render();
  });

  elements.sortFilter.addEventListener("change", (event) => {
    state.selectedSort = event.target.value;
    render();
  });

  elements.randomBtn.addEventListener("click", handleRandomPick);

  elements.resetFiltersBtn.addEventListener("click", () => {
    state.selectedTags.clear();
    state.searchKeyword = "";
    state.selectedCategory = "all";
    state.selectedSort = "default";

    elements.searchInput.value = "";
    elements.categoryFilter.value = "all";
    elements.sortFilter.value = "default";

    renderTagFilters();
    render();
    elements.randomResult.classList.add("hidden");
  });
}

function renderCategoryOptions() {
  const categories = [...new Set(state.restaurants.map((item) => item.category))].sort();
  const options = categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");

  elements.categoryFilter.insertAdjacentHTML("beforeend", options);
}

function renderTagFilters() {
  const tags = [...new Set(state.restaurants.flatMap((item) => item.tags))].sort();

  elements.tagFilters.innerHTML = "";

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-btn ${state.selectedTags.has(tag) ? "active" : ""}`.trim();
    button.textContent = `#${tag}`;

    button.addEventListener("click", () => {
      if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
      } else {
        state.selectedTags.add(tag);
      }
      renderTagFilters();
      render();
    });

    elements.tagFilters.appendChild(button);
  });
}

function getFilteredRestaurants() {
  let filtered = [...state.restaurants];

  if (state.searchKeyword) {
    filtered = filtered.filter((item) => {
      const haystack = [item.name, item.category, item.comment, ...item.tags].join(" ").toLowerCase();
      return haystack.includes(state.searchKeyword);
    });
  }

  if (state.selectedCategory !== "all") {
    filtered = filtered.filter((item) => item.category === state.selectedCategory);
  }

  if (state.selectedTags.size > 0) {
    filtered = filtered.filter((item) =>
      [...state.selectedTags].every((tag) => item.tags.includes(tag))
    );
  }

  switch (state.selectedSort) {
    case "priceAsc":
      filtered.sort((a, b) => a.price - b.price);
      break;
    case "priceDesc":
      filtered.sort((a, b) => b.price - a.price);
      break;
    case "nameAsc":
      filtered.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      break;
    default:
      filtered.sort((a, b) => a.id - b.id);
      break;
  }

  return filtered;
}

function render() {
  const filtered = getFilteredRestaurants();
  renderSummary(filtered);
  renderRestaurantList(filtered);
}

function renderSummary(filtered) {
  elements.resultCount.textContent = `총 ${filtered.length}곳`;

  const parts = [];
  if (state.selectedCategory !== "all") parts.push(`카테고리: ${state.selectedCategory}`);
  if (state.selectedTags.size > 0) parts.push(`태그: ${[...state.selectedTags].join(", ")}`);
  if (state.searchKeyword) parts.push(`검색어: ${state.searchKeyword}`);

  elements.activeFilterText.textContent = parts.length > 0
    ? `${parts.join(" / ")} 조건으로 보는 중`
    : "전체 맛집을 보여주는 중";
}

function renderRestaurantList(restaurants) {
  elements.restaurantList.innerHTML = "";

  if (restaurants.length === 0) {
    elements.emptyState.classList.remove("hidden");
    return;
  }

  elements.emptyState.classList.add("hidden");

  restaurants.forEach((item) => {
    const fragment = elements.cardTemplate.content.cloneNode(true);

    fragment.querySelector(".card-title").textContent = item.name;
    fragment.querySelector(".card-category").textContent = item.category;
    fragment.querySelector(".card-price").textContent = formatPrice(item.price);
    fragment.querySelector(".card-comment").textContent = item.comment;

    const tagContainer = fragment.querySelector(".card-tags");
    item.tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "card-tag";
      span.textContent = `#${tag}`;
      tagContainer.appendChild(span);
    });

    const mapLink = fragment.querySelector(".map-link");
    mapLink.href = item.naverMapUrl;

    elements.restaurantList.appendChild(fragment);
  });
}

function handleRandomPick() {
  const filtered = getFilteredRestaurants();

  if (filtered.length === 0) {
    alert("지금 조건으로는 랜덤 추천할 맛집이 없어! 필터를 조금 풀어봐 😆");
    return;
  }

  const picked = filtered[Math.floor(Math.random() * filtered.length)];

  elements.randomName.textContent = picked.name;
  elements.randomMeta.textContent = `${picked.category} · ${formatPrice(picked.price)} · ${picked.tags.map((tag) => `#${tag}`).join(" ")}`;
  elements.randomComment.textContent = picked.comment;
  elements.randomMapLink.href = picked.naverMapUrl;
  elements.randomResult.classList.remove("hidden");
  elements.randomResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatPrice(price) {
  return `${price.toLocaleString("ko-KR")}원`;
}

init();
