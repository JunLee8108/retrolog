// ==================== Goals Module ====================

let currentFilter = "all";
let selectedGoalType = "monthly";
let selectedGoalColor = "red";
let editingGoalId = null;

// Period selection state
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth() + 1;
let selectedWeek = 1;

// ==================== Initialize ====================
async function initGoals() {
  await renderGoals();
  initGoalModal();
  initGoalFilters();
}

// ==================== Filters ====================
function initGoalFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      await renderGoals();
    });
  });

  document.getElementById("addGoalBtn").addEventListener("click", () => {
    editingGoalId = null;
    openGoalModal();
  });
}

// ==================== Render Goals ====================
async function renderGoals() {
  const container = document.getElementById("goalsList");
  let allGoals = await GoalsDB.getAll();

  const filtered =
    currentFilter === "all"
      ? allGoals
      : allGoals.filter((g) => g.type === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="goals-empty">
        <div class="goals-empty-icon">🎯</div>
        <div class="goals-empty-text">목표를 추가해보세요</div>
      </div>
    `;
    await updateDashboardGoals();
    return;
  }

  container.innerHTML = filtered.map((goal) => renderGoalCard(goal)).join("");

  bindGoalEvents();
  await updateDashboardGoals();
}

// ==================== Render Single Goal Card ====================
function renderGoalCard(goal) {
  const completed = goal.milestones.filter((m) => m.completed).length;
  const total = goal.milestones.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const typeLabel = { yearly: "연간", monthly: "월간", weekly: "주간" }[
    goal.type
  ];

  return `
    <div class="goal-card color-${goal.color}" data-id="${goal.id}">
      <div class="goal-header">
        <div class="goal-title">
          🎯 ${goal.title}
          <span class="goal-type-badge">${typeLabel}</span>
        </div>
        <div class="goal-actions">
          <button class="goal-action-btn edit" data-id="${
            goal.id
          }" title="수정">✎</button>
          <button class="goal-action-btn delete" data-id="${
            goal.id
          }" title="삭제">🗑</button>
        </div>
      </div>
      
      <div class="goal-date">${formatDate(goal.startDate)} ~ ${formatDate(
    goal.endDate
  )}</div>
      
      <div class="goal-progress">
        <div class="progress-bar">
          <div class="progress-fill ${
            goal.color
          }" style="width: ${percent}%"></div>
        </div>
        <div class="progress-text">${completed}/${total} 완료 (${percent}%)</div>
      </div>
      
      <div class="milestones-section">
        <div class="milestones-title">마일스톤</div>
        <ul class="milestone-list">
          ${goal.milestones
            .map(
              (ms) => `
            <li class="milestone-item ${
              ms.completed ? "completed" : ""
            }" data-id="${ms.id}">
              <div class="milestone-checkbox ${
                ms.completed ? "checked" : ""
              }" data-id="${ms.id}" data-goal-id="${goal.id}"></div>
              <span class="milestone-text">${ms.title}</span>
              <button class="milestone-delete" data-id="${
                ms.id
              }" data-goal-id="${goal.id}">✕</button>
            </li>
          `
            )
            .join("")}
        </ul>
        <div class="add-milestone">
          <input type="text" placeholder="새 마일스톤..." data-goal-id="${
            goal.id
          }">
          <button class="btn" data-goal-id="${goal.id}">추가</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== Update Goal Card (Partial) ====================
async function updateGoalCard(goalId) {
  const allGoals = await GoalsDB.getAll();
  const goal = allGoals.find((g) => g.id === goalId);
  if (!goal) return;

  const card = document.querySelector(`.goal-card[data-id="${goalId}"]`);
  if (!card) return;

  // Update progress bar
  const completed = goal.milestones.filter((m) => m.completed).length;
  const total = goal.milestones.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const progressFill = card.querySelector(".progress-fill");
  const progressText = card.querySelector(".progress-text");

  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressText)
    progressText.textContent = `${completed}/${total} 완료 (${percent}%)`;

  // Update milestones list
  const milestoneList = card.querySelector(".milestone-list");
  if (milestoneList) {
    milestoneList.innerHTML = goal.milestones
      .map(
        (ms) => `
      <li class="milestone-item ${ms.completed ? "completed" : ""}" data-id="${
          ms.id
        }">
        <div class="milestone-checkbox ${
          ms.completed ? "checked" : ""
        }" data-id="${ms.id}" data-goal-id="${goal.id}"></div>
        <span class="milestone-text">${ms.title}</span>
        <button class="milestone-delete" data-id="${ms.id}" data-goal-id="${
          goal.id
        }">✕</button>
      </li>
    `
      )
      .join("");

    // Rebind events for this card's milestones
    bindMilestoneEvents(card, goalId);
  }

  await updateDashboardGoals();
}

// ==================== Bind Milestone Events (Single Card) ====================
function bindMilestoneEvents(card, goalId) {
  // Milestone checkbox
  card.querySelectorAll(".milestone-checkbox").forEach((cb) => {
    cb.onclick = async () => {
      await MilestonesDB.toggle(Number(cb.dataset.id));
      await updateGoalCard(goalId);
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });

  // Milestone delete
  card.querySelectorAll(".milestone-delete").forEach((btn) => {
    btn.onclick = async () => {
      await MilestonesDB.delete(Number(btn.dataset.id));
      await updateGoalCard(goalId);
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });
}

// ==================== Bind Events ====================
function bindGoalEvents() {
  // Edit button
  document.querySelectorAll(".goal-action-btn.edit").forEach((btn) => {
    btn.onclick = () => {
      editingGoalId = Number(btn.dataset.id);
      openGoalModal(editingGoalId);
    };
  });

  // Delete button
  document.querySelectorAll(".goal-action-btn.delete").forEach((btn) => {
    btn.onclick = async () => {
      if (confirm("이 목표를 삭제하시겠습니까?")) {
        await GoalsDB.delete(Number(btn.dataset.id));
        await renderGoals();
      }
    };
  });

  // Milestone checkbox - 부분 업데이트
  document.querySelectorAll(".milestone-checkbox").forEach((cb) => {
    cb.onclick = async () => {
      await MilestonesDB.toggle(Number(cb.dataset.id));
      await updateGoalCard(Number(cb.dataset.goalId));
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });

  // Milestone delete - 부분 업데이트
  document.querySelectorAll(".milestone-delete").forEach((btn) => {
    btn.onclick = async () => {
      await MilestonesDB.delete(Number(btn.dataset.id));
      await updateGoalCard(Number(btn.dataset.goalId));
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });

  // Add milestone - 부분 업데이트
  document.querySelectorAll(".add-milestone .btn").forEach((btn) => {
    btn.onclick = async () => {
      const goalId = Number(btn.dataset.goalId);
      const input = document.querySelector(
        `.add-milestone input[data-goal-id="${goalId}"]`
      );
      const text = input.value.trim();
      if (!text) return;

      await MilestonesDB.add({
        goalId: goalId,
        title: text,
        completed: false,
      });

      input.value = "";
      await updateGoalCard(goalId);
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });

  document.querySelectorAll(".add-milestone input").forEach((input) => {
    input.onkeypress = (e) => {
      if (e.key === "Enter") {
        const btn = document.querySelector(
          `.add-milestone .btn[data-goal-id="${input.dataset.goalId}"]`
        );
        btn.click();
      }
    };
  });
}

// ==================== Goal Modal ====================
function initGoalModal() {
  const modal = document.getElementById("goalModal");

  document.getElementById("closeGoalModal").onclick = closeGoalModal;
  document.getElementById("cancelGoal").onclick = closeGoalModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeGoalModal();
  };

  // Type options
  document.querySelectorAll(".type-option").forEach((opt) => {
    opt.onclick = () => {
      document
        .querySelectorAll(".type-option")
        .forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedGoalType = opt.dataset.type;
      updatePeriodSelects();
    };
  });

  // Color options
  document.querySelectorAll("#goalModal .color-option").forEach((opt) => {
    opt.onclick = () => {
      document
        .querySelectorAll("#goalModal .color-option")
        .forEach((c) => c.classList.remove("selected"));
      opt.classList.add("selected");
      selectedGoalColor = opt.dataset.color;
    };
  });

  // Period select change handlers
  document.getElementById("goalYearSelect").onchange = (e) => {
    selectedYear = Number(e.target.value);
    if (selectedGoalType === "weekly") populateWeekSelect();
    updatePeriodPreview();
  };

  document.getElementById("goalMonthSelect").onchange = (e) => {
    selectedMonth = Number(e.target.value);
    if (selectedGoalType === "weekly") populateWeekSelect();
    updatePeriodPreview();
  };

  document.getElementById("goalWeekSelect").onchange = (e) => {
    selectedWeek = Number(e.target.value);
    updatePeriodPreview();
  };

  document.getElementById("saveGoal").onclick = saveGoal;
  document.getElementById("goalTitleInput").onkeypress = (e) => {
    if (e.key === "Enter") saveGoal();
  };
}

// ==================== Period Selects ====================
function populateYearSelect() {
  const select = document.getElementById("goalYearSelect");
  const currentYear = new Date().getFullYear();

  select.innerHTML = "";
  for (let y = currentYear - 1; y <= currentYear + 5; y++) {
    select.innerHTML += `<option value="${y}" ${
      y === selectedYear ? "selected" : ""
    }>${y}년</option>`;
  }
}

function populateMonthSelect() {
  const select = document.getElementById("goalMonthSelect");

  select.innerHTML = "";
  for (let m = 1; m <= 12; m++) {
    select.innerHTML += `<option value="${m}" ${
      m === selectedMonth ? "selected" : ""
    }>${m}월</option>`;
  }
}

function populateWeekSelect() {
  const select = document.getElementById("goalWeekSelect");
  const weeks = getWeeksInMonth(selectedYear, selectedMonth);

  select.innerHTML = "";
  weeks.forEach((week, idx) => {
    const weekNum = idx + 1;
    const label = `${weekNum}주차 (${week.startLabel}~${week.endLabel})`;
    select.innerHTML += `<option value="${weekNum}" ${
      weekNum === selectedWeek ? "selected" : ""
    }>${label}</option>`;
  });

  if (selectedWeek > weeks.length) {
    selectedWeek = 1;
    select.value = 1;
  }
}

function getWeeksInMonth(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  let current = new Date(firstDay);
  current.setDate(current.getDate() - current.getDay());

  while (weeks.length < 6) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekHasDaysInMonth =
      (weekStart.getMonth() === month - 1 &&
        weekStart.getFullYear() === year) ||
      (weekEnd.getMonth() === month - 1 && weekEnd.getFullYear() === year) ||
      (weekStart < firstDay && weekEnd >= firstDay);

    if (weekHasDaysInMonth) {
      weeks.push({
        start: new Date(weekStart),
        end: new Date(weekEnd),
        startLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        endLabel: `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
      });
    }

    current.setDate(current.getDate() + 7);
    if (current > lastDay && current.getMonth() !== month - 1) break;
  }

  return weeks;
}

function updatePeriodSelects() {
  const yearSelect = document.getElementById("goalYearSelect");
  const monthSelect = document.getElementById("goalMonthSelect");
  const weekSelect = document.getElementById("goalWeekSelect");

  populateYearSelect();

  switch (selectedGoalType) {
    case "yearly":
      monthSelect.disabled = true;
      weekSelect.disabled = true;
      break;
    case "monthly":
      monthSelect.disabled = false;
      weekSelect.disabled = true;
      populateMonthSelect();
      break;
    case "weekly":
      monthSelect.disabled = false;
      weekSelect.disabled = false;
      populateMonthSelect();
      populateWeekSelect();
      break;
  }

  updatePeriodPreview();
}

function updatePeriodPreview() {
  const preview = document.getElementById("periodPreview");
  const { startDate, endDate } = calculatePeriodDates();
  preview.textContent = `📅 ${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

function calculatePeriodDates() {
  let startDate, endDate;

  switch (selectedGoalType) {
    case "yearly":
      startDate = `${selectedYear}-01-01`;
      endDate = `${selectedYear}-12-31`;
      break;
    case "monthly":
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      startDate = `${selectedYear}-${String(selectedMonth).padStart(
        2,
        "0"
      )}-01`;
      endDate = `${selectedYear}-${String(selectedMonth).padStart(
        2,
        "0"
      )}-${String(lastDayOfMonth).padStart(2, "0")}`;
      break;
    case "weekly":
      const weeks = getWeeksInMonth(selectedYear, selectedMonth);
      const week = weeks[selectedWeek - 1];
      if (week) {
        startDate = formatDateISO(week.start);
        endDate = formatDateISO(week.end);
      } else {
        startDate = `${selectedYear}-${String(selectedMonth).padStart(
          2,
          "0"
        )}-01`;
        endDate = `${selectedYear}-${String(selectedMonth).padStart(
          2,
          "0"
        )}-07`;
      }
      break;
  }

  return { startDate, endDate };
}

async function openGoalModal(goalId = null) {
  const modal = document.getElementById("goalModal");
  const title = document.getElementById("goalModalTitle");

  const now = new Date();
  selectedYear = now.getFullYear();
  selectedMonth = now.getMonth() + 1;
  selectedWeek = 1;

  if (goalId) {
    const allGoals = await GoalsDB.getAll();
    const goal = allGoals.find((g) => g.id === goalId);
    if (goal) {
      title.textContent = "목표 수정";
      document.getElementById("goalTitleInput").value = goal.title;
      selectedGoalType = goal.type;
      selectedGoalColor = goal.color;

      const [startYear, startMonth] = goal.startDate.split("-").map(Number);
      selectedYear = startYear;
      selectedMonth = startMonth;

      if (goal.type === "weekly") {
        const weeks = getWeeksInMonth(selectedYear, selectedMonth);
        const goalStart = new Date(goal.startDate + "T00:00:00");
        weeks.forEach((w, idx) => {
          if (w.start.getTime() === goalStart.getTime()) {
            selectedWeek = idx + 1;
          }
        });
      }
    }
  } else {
    title.textContent = "새 목표 추가";
    document.getElementById("goalTitleInput").value = "";
    selectedGoalType = "monthly";
    selectedGoalColor = "red";
  }

  document.querySelectorAll(".type-option").forEach((o) => {
    o.classList.toggle("selected", o.dataset.type === selectedGoalType);
  });
  document.querySelectorAll("#goalModal .color-option").forEach((c) => {
    c.classList.toggle("selected", c.dataset.color === selectedGoalColor);
  });

  updatePeriodSelects();
  modal.classList.add("active");
  setTimeout(() => document.getElementById("goalTitleInput").focus(), 100);
}

function closeGoalModal() {
  document.getElementById("goalModal").classList.remove("active");
  editingGoalId = null;
}

async function saveGoal() {
  const title = document.getElementById("goalTitleInput").value.trim();
  if (!title) return;

  const { startDate, endDate } = calculatePeriodDates();

  if (editingGoalId) {
    await GoalsDB.update(editingGoalId, {
      title,
      type: selectedGoalType,
      color: selectedGoalColor,
      startDate,
      endDate,
    });
  } else {
    await GoalsDB.add({
      title,
      type: selectedGoalType,
      color: selectedGoalColor,
      startDate,
      endDate,
    });
  }

  closeGoalModal();
  await renderGoals();
}

// ==================== Dashboard Integration ====================
async function updateDashboardGoals() {
  const allGoals = await GoalsDB.getAll();
  const totalMilestones = allGoals.reduce(
    (sum, g) => sum + g.milestones.length,
    0
  );
  const completedMilestones = allGoals.reduce(
    (sum, g) => sum + g.milestones.filter((m) => m.completed).length,
    0
  );
  const percent =
    totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

  const el = document.getElementById("goalPercent");
  if (el) el.textContent = percent + "%";
}

// ==================== Helpers ====================
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}
