// ==================== Today Page Module ====================

// ==================== Initialize ====================
async function initTodayPage() {
  await renderTodayPage();
  bindTodaySectionLinks();
}

// ==================== Render Full Today Page ====================
async function renderTodayPage() {
  await renderTodayTodosForTodayPage();
  await renderUpcomingEvents();
  await renderActiveGoals();
  await renderRecentNotes();
  await updateTodayStats();
}

// ==================== Section Link Bindings ====================
function bindTodaySectionLinks() {
  document.querySelectorAll(".today-section-link").forEach((link) => {
    link.addEventListener("click", () => {
      const targetPage = link.dataset.page;
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelector(`.tab[data-page="${targetPage}"]`)
        .classList.add("active");
      document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
      document.getElementById(targetPage).classList.add("active");

      window.scrollTo({ top: 0, behavior: "instant" });
    });
  });
}

// ==================== Update Stats Circles ====================
async function updateTodayStats() {
  // Todo stats
  const todos = await TodosDB.getTodayAndUndated();
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const todoPercent = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("todayTotal").textContent = total;
  document.getElementById("todayDone").textContent = done;
  document.getElementById("todoCircleText").textContent = todoPercent + "%";

  const todoCircle = document.getElementById("todoCircle");
  const todoOffset = 94.2 - (94.2 * todoPercent) / 100;
  todoCircle.style.strokeDashoffset = todoOffset;

  // Goal stats
  const allGoals = await GoalsDB.getAll();
  const totalMilestones = allGoals.reduce(
    (sum, g) => sum + g.milestones.length,
    0,
  );
  const completedMilestones = allGoals.reduce(
    (sum, g) => sum + g.milestones.filter((m) => m.completed).length,
    0,
  );
  const goalPercent =
    totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

  document.getElementById("goalCircleText").textContent = goalPercent + "%";
  document.getElementById("goalProgressText").textContent =
    `${completedMilestones} / ${totalMilestones} 마일스톤`;

  const goalCircle = document.getElementById("goalCircle");
  const goalOffset = 94.2 - (94.2 * goalPercent) / 100;
  goalCircle.style.strokeDashoffset = goalOffset;

  // Also update dashboard goal percent for compatibility
  const goalPercentEl = document.getElementById("goalPercent");
  if (goalPercentEl) goalPercentEl.textContent = goalPercent + "%";
}

// ==================== Render Today Todos (for Today Page) ====================
async function renderTodayTodosForTodayPage() {
  const todos = await TodosDB.getTodayAndUndated();
  const todayList = document.getElementById("todayTodoList");

  if (todos.length === 0) {
    todayList.innerHTML = `
      <div class="today-empty">
        <div class="today-empty-icon">✔</div>
        <div>오늘 할 일이 없습니다</div>
      </div>
    `;
    return;
  }

  // Sort by priority then show max 5
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  const display = sorted.slice(0, 5);

  todayList.innerHTML = display
    .map(
      (t) => `
    <li class="today-todo-item ${t.done ? "completed" : ""}" data-id="${t.id}">
      <div class="checkbox ${t.done ? "checked" : ""}" data-id="${t.id}"></div>
      <span class="today-todo-text" data-id="${t.id}">${escapeHtmlToday(
        t.text,
      )}</span>
      <span class="todo-priority ${t.priority}">${t.priority}</span>
    </li>
  `,
    )
    .join("");

  if (todos.length > 5) {
    todayList.innerHTML += `
      <li class="today-todo-item" style="justify-content: center; border-bottom: none;">
        <button class="today-section-link" data-page="todos">+${
          todos.length - 5
        }개 더보기</button>
      </li>
    `;
  }

  bindTodayTodoEvents();
}

function bindTodayTodoEvents() {
  // Checkbox toggle
  document.querySelectorAll("#todayTodoList .checkbox").forEach((cb) => {
    cb.onclick = async () => {
      await TodosDB.toggle(cb.dataset.id);
      await renderTodayPage();
      if (typeof renderTodos === "function") await renderTodos();
      if (typeof renderCalendar === "function") {
        await renderCalendar();
        await renderCalendarList();
      }
    };
  });

  // Click todo text to edit
  document
    .querySelectorAll("#todayTodoList .today-todo-text")
    .forEach((text) => {
      text.onclick = () => {
        if (typeof openEditTodoModal === "function") {
          openEditTodoModal(text.dataset.id);
        }
      };
    });

  // More button link
  document
    .querySelectorAll("#todayTodoList .today-section-link")
    .forEach((link) => {
      link.addEventListener("click", () => {
        document
          .querySelectorAll(".tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelector('.tab[data-page="todos"]')
          .classList.add("active");
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document.getElementById("todos").classList.add("active");

        window.scrollTo({ top: 0, behavior: "instant" });
      });
    });
}

// ==================== Render Upcoming Events ====================
async function renderUpcomingEvents() {
  const container = document.getElementById("upcomingEvents");
  const allEvents = await EventsDB.getAll();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKeyToday(today);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = formatDateKeyToday(weekEnd);

  // Filter events within next 7 days
  const upcomingEvents = allEvents
    .filter((ev) => {
      const eventEnd = ev.endDate || ev.date;
      return ev.date <= weekEndKey && eventEnd >= todayKey;
    })
    .sort((a, b) => {
      // 다일 일정의 경우 표시 날짜 기준으로 정렬
      const aDisplayDate = getDisplayDate(a, todayKey);
      const bDisplayDate = getDisplayDate(b, todayKey);
      if (aDisplayDate !== bDisplayDate)
        return aDisplayDate.localeCompare(bDisplayDate);
      return (a.time || "").localeCompare(b.time || "");
    });

  if (upcomingEvents.length === 0) {
    container.innerHTML = `
      <div class="today-empty">
        <div class="today-empty-icon">📅</div>
        <div>다가오는 일정이 없습니다</div>
      </div>
    `;
    return;
  }

  // Group by display date (considering multi-day events)
  const grouped = {};
  upcomingEvents.slice(0, 8).forEach((ev) => {
    // 다일 일정이고 시작일이 오늘 이전이면 오늘 날짜로 그룹핑
    const displayDate = getDisplayDate(ev, todayKey);
    if (!grouped[displayDate]) grouped[displayDate] = [];
    grouped[displayDate].push(ev);
  });

  let html = "";
  for (const [dateKey, events] of Object.entries(grouped)) {
    const label = getDateLabelToday(dateKey, todayKey);
    const isToday = dateKey === todayKey;

    html += `<div class="upcoming-date-group">`;
    html += `<div class="upcoming-date-label ${
      isToday ? "today-label" : ""
    }">${label}</div>`;

    events.forEach((ev) => {
      const timeDisplay = ev.allDay ? "종일" : ev.time || "";
      const isMultiDay = ev.endDate && ev.endDate !== ev.date;

      html += `
        <div class="upcoming-event" data-date="${ev.date}">
          <div class="upcoming-event-dot ${ev.color}"></div>
          <span class="upcoming-event-time">${timeDisplay}</span>
          <span class="upcoming-event-text">${escapeHtmlToday(ev.text)}</span>
          ${isMultiDay ? '<span class="upcoming-event-badge">다일</span>' : ""}
        </div>
      `;
    });

    html += `</div>`;
  }

  container.innerHTML = html;

  // Bind click to open calendar view modal
  container.querySelectorAll(".upcoming-event").forEach((ev) => {
    ev.onclick = () => {
      if (typeof openViewEventsModal === "function") {
        openViewEventsModal(ev.dataset.date);
      }
    };
  });
}

// ==================== Render Active Goals ====================
async function renderActiveGoals() {
  const container = document.getElementById("activeGoals");
  const allGoals = await GoalsDB.getAll();

  const today = new Date();
  const todayKey = formatDateKeyToday(today);

  // Filter active goals (not yet ended)
  const activeGoals = allGoals
    .filter((g) => g.endDate >= todayKey)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 3);

  if (activeGoals.length === 0) {
    container.innerHTML = `
      <div class="today-empty">
        <div class="today-empty-icon">🎯</div>
        <div>진행 중인 목표가 없습니다</div>
      </div>
    `;
    return;
  }

  container.innerHTML = activeGoals
    .map((goal) => {
      const completed = goal.milestones.filter((m) => m.completed).length;
      const total = goal.milestones.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const typeLabel = { yearly: "연간", monthly: "월간", weekly: "주간" }[
        goal.type
      ];

      return `
      <div class="active-goal-card color-${goal.color}" data-id="${goal.id}">
        <div class="active-goal-info">
          <div class="active-goal-title">${escapeHtmlToday(goal.title)}</div>
          <div class="active-goal-meta">${typeLabel} · ${formatDateShortToday(
            goal.endDate,
          )} 까지</div>
        </div>
        <div class="active-goal-progress">
          <div class="active-goal-bar">
            <div class="active-goal-fill ${
              goal.color
            }" style="width: ${percent}%"></div>
          </div>
          <div class="active-goal-percent">${completed}/${total}</div>
        </div>
      </div>
    `;
    })
    .join("");

  // Bind click to go to goals page and scroll to target
  container.querySelectorAll(".active-goal-card").forEach((card) => {
    card.onclick = async () => {
      const goalId = card.dataset.id;

      // 1. 필터를 "전체"로 리셋
      currentFilter = "all";
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.filter === "all");
      });
      await renderGoals();

      // 2. 탭 전환
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document.querySelector('.tab[data-page="goals"]').classList.add("active");
      document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
      document.getElementById("goals").classList.add("active");

      // 3. 해당 목표로 스크롤 이동
      setTimeout(() => {
        const targetGoal = document.querySelector(
          `.goal-card[data-id="${goalId}"]`,
        );
        if (targetGoal) {
          targetGoal.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    };
  });
}

// ==================== Render Recent Notes ====================
async function renderRecentNotes() {
  const container = document.getElementById("recentNotes");
  const allNotes = await NotesDB.getAll();

  // Already sorted by updatedAt desc, take first 3
  const recentNotes = allNotes.slice(0, 3);

  if (recentNotes.length === 0) {
    container.innerHTML = `
      <div class="today-empty" style="grid-column: 1 / -1;">
        <div class="today-empty-icon">📝</div>
        <div>메모가 없습니다</div>
      </div>
    `;
    return;
  }

  container.innerHTML = recentNotes
    .map((note) => {
      const preview =
        note.content.length > 50
          ? note.content.substring(0, 50) + "..."
          : note.content;

      return `
      <div class="recent-note-card color-${note.color}" data-id="${note.id}">
        <div class="recent-note-title">
          ${note.pinned ? '<span class="recent-note-pin">📌</span> ' : ""}${
            escapeHtmlToday(note.title) || "제목 없음"
          }
        </div>
        <div class="recent-note-preview">${escapeHtmlToday(preview)}</div>
      </div>
    `;
    })
    .join("");

  // Bind click to go to notes page and open modal
  container.querySelectorAll(".recent-note-card").forEach((card) => {
    card.onclick = async () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document.querySelector('.tab[data-page="notes"]').classList.add("active");
      document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
      document.getElementById("notes").classList.add("active");

      // Open the note modal if function exists
      if (typeof openNoteModal === "function") {
        setTimeout(() => openNoteModal(card.dataset.id), 100);
      }
    };
  });
}

// ==================== Helper Functions ====================
function formatDateKeyToday(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateLabelToday(dateKey, todayKey) {
  if (dateKey === todayKey) return "오늘";

  const today = new Date(todayKey + "T00:00:00");
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateKeyToday(tomorrow);
  if (dateKey === tomorrowKey) return "내일";

  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}/${d} (${weekdays[date.getDay()]})`;
}

function formatDateShortToday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function getDisplayDate(event, todayKey) {
  if (event.endDate && event.date < todayKey && event.endDate >= todayKey) {
    return todayKey;
  }
  return event.date;
}

function escapeHtmlToday(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
