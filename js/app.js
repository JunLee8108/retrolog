// ==================== Main App ====================

// ==================== DOM Helpers ====================
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

// ==================== Initialize ====================
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();

  // Auth 초기화 - 로그인 체크
  const isLoggedIn = await initAuth();

  if (isLoggedIn) {
    await initializeApp();
  }
});

// ==================== Initialize App (after auth) ====================
async function initializeApp() {
  initTabs();
  initTodayDisplay();

  // Initialize modules
  if (typeof initTodos === "function") await initTodos();
  if (typeof initCalendar === "function") await initCalendar();
  if (typeof initGoals === "function") await initGoals();
  if (typeof initNotes === "function") await initNotes();
  if (typeof initTodayPage === "function") await initTodayPage();
  if (typeof initSettings === "function") await initSettings();

  // Apply saved start page
  await applyStartPage();

  // 모든 초기화 완료 후 로딩 화면 숨김
  hideLoadingScreen();
}

// ==================== Start Page ====================
async function applyStartPage() {
  const startPage = await SettingsDB.get("startPage");
  if (startPage && startPage !== "today") {
    const tab = document.querySelector(`.tab[data-page="${startPage}"]`);
    if (tab) {
      tab.click();
    }
  }
}

// ==================== Theme ====================
function initTheme() {
  $("themeToggle").addEventListener("click", () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "light" : "dark",
    );
    localStorage.setItem("planner_theme", isDark ? "light" : "dark");
  });

  // Load saved theme
  const savedTheme = localStorage.getItem("planner_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }
}

// ==================== Tabs ====================
function initTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $$(".page").forEach((p) => {
        p.classList.remove("active");
        if (p.id === tab.dataset.page) p.classList.add("active");
      });

      window.scrollTo({ top: 0, behavior: "instant" });

      // Refresh Today page when switching to it
      if (
        tab.dataset.page === "today" &&
        typeof renderTodayPage === "function"
      ) {
        await renderTodayPage();
      }

      // Refresh Settings page when switching to it
      if (
        tab.dataset.page === "settings" &&
        typeof renderStorageUsage === "function"
      ) {
        await renderStorageUsage();
      }
    });
  });
}

// ==================== Today Display ====================
function initTodayDisplay() {
  const today = new Date();
  const daysEn = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  $("todayDateMain").textContent =
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  $("todayDateSub").textContent = daysEn[today.getDay()];
}
