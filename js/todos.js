// ==================== Todos Module ====================

// ==================== Filter State ====================
let todoFilters = { search: "", priority: "all", date: "all" };

// ==================== Pagination State ====================
let completedPage = 1;
const ITEMS_PER_PAGE = 10;
const PAGE_GROUP_SIZE = 5;

let debounceTimer = null;
let editingTodoId = null;

// ==================== Initialize ====================
async function initTodos() {
  document.getElementById("addTodoBtn").onclick = addTodo;
  document.getElementById("todoInput").onkeypress = (e) => {
    if (e.key === "Enter") addTodo();
  };

  const todoDateInput = document.getElementById("todoDate");
  if (todoDateInput) todoDateInput.value = getTodayDateKey();

  initRecurringDropdown();
  initSearch();
  initFilters();
  initAccordions();
  initEditTodoModal();

  await renderTodos();
  await renderTodayTodos();
}

// ==================== Accordion ====================
function initAccordions() {
  document
    .getElementById("pendingAccordionHeader")
    .addEventListener("click", () => toggleAccordion("pending"));
  document
    .getElementById("completedAccordionHeader")
    .addEventListener("click", () => toggleAccordion("completed"));
}

function toggleAccordion(type) {
  const header = document.getElementById(`${type}AccordionHeader`);
  const content = document.getElementById(`${type}AccordionContent`);
  const arrow = header.querySelector(".todo-accordion-arrow");
  const isOpen = header.classList.contains("open");

  if (isOpen) {
    header.classList.remove("open");
    content.classList.remove("open");
    arrow.textContent = "▶";
  } else {
    header.classList.add("open");
    content.classList.add("open");
    arrow.textContent = "▼";
  }
}

// ==================== Recurring Dropdown ====================
function initRecurringDropdown() {
  const dropdown = document.getElementById("recurringDropdown");
  const toggle = document.getElementById("recurringToggle");
  const menu = document.getElementById("recurringMenu");
  const options = menu.querySelectorAll(".recurring-option");
  const intervalGroup = document.getElementById("recurringIntervalGroup");

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  options.forEach((option) => {
    option.addEventListener("click", () => {
      const value = option.dataset.value;
      options.forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");

      const labels = {
        daily: "매일",
        weekly: "매주",
        monthly: "매월",
        yearly: "매년",
      };

      if (value === "none") {
        toggle.innerHTML = `<svg class="recurring-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg> 반복 <span class="filter-arrow">▼</span>`;
        toggle.classList.remove("active");
        intervalGroup.style.display = "none";
      } else if (value === "custom") {
        toggle.innerHTML = `<svg class="recurring-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg> 사용자 지정 <span class="filter-arrow">▼</span>`;
        toggle.classList.add("active");
        intervalGroup.style.display = "flex";
      } else {
        toggle.innerHTML = `<svg class="recurring-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg> ${labels[value]} <span class="filter-arrow">▼</span>`;
        toggle.classList.add("active");
        intervalGroup.style.display = "none";
      }
      dropdown.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) dropdown.classList.remove("open");
  });
}

function getRecurringValues() {
  const selectedOption = document.querySelector(
    "#recurringMenu .recurring-option.selected",
  );
  const value = selectedOption?.dataset.value || "none";
  if (value === "none")
    return { recurring: false, recurringType: null, recurringInterval: 1 };
  if (value === "custom") {
    return {
      recurring: true,
      recurringType: document.getElementById("recurringCustomType").value,
      recurringInterval:
        parseInt(document.getElementById("recurringInterval").value) || 1,
    };
  }
  return { recurring: true, recurringType: value, recurringInterval: 1 };
}

function resetRecurringDropdown() {
  const toggle = document.getElementById("recurringToggle");
  const options = document.querySelectorAll("#recurringMenu .recurring-option");
  const intervalGroup = document.getElementById("recurringIntervalGroup");
  options.forEach((o) =>
    o.classList.toggle("selected", o.dataset.value === "none"),
  );
  toggle.innerHTML = `<svg class="recurring-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg> 반복 <span class="filter-arrow">▼</span>`;
  toggle.classList.remove("active");
  intervalGroup.style.display = "none";
  document.getElementById("recurringInterval").value = "1";
  document.getElementById("recurringCustomType").value = "daily";
}

// ==================== Search & Filters ====================
function initSearch() {
  document.getElementById("todoSearchInput").addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      todoFilters.search = e.target.value.toLowerCase().trim();
      completedPage = 1;
      await renderTodos();
    }, 300);
  });
}

function initFilters() {
  const dropdowns = document.querySelectorAll("#todos .filter-dropdown");
  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector(".filter-toggle");
    const menu = dropdown.querySelector(".filter-menu");
    const options = menu.querySelectorAll(".filter-option");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdowns.forEach((d) => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    options.forEach((option) => {
      option.addEventListener("click", async () => {
        const value = option.dataset.value;
        const filterType = toggle.id === "priorityFilter" ? "priority" : "date";
        todoFilters[filterType] = value;
        options.forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");
        toggle.innerHTML = `${option.textContent} <span class="filter-arrow">▼</span>`;
        toggle.classList.toggle("active", value !== "all");
        dropdown.classList.remove("open");
        completedPage = 1;
        await renderTodos();
      });
    });
  });

  document.addEventListener("click", () =>
    dropdowns.forEach((d) => d.classList.remove("open")),
  );

  document.getElementById("filterReset").addEventListener("click", async () => {
    todoFilters = { search: "", priority: "all", date: "all" };
    document.getElementById("todoSearchInput").value = "";
    completedPage = 1;
    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector(".filter-toggle");
      dropdown
        .querySelectorAll(".filter-option")
        .forEach((o) =>
          o.classList.toggle("selected", o.dataset.value === "all"),
        );
      toggle.innerHTML = `${toggle.id === "priorityFilter" ? "우선순위" : "날짜"} <span class="filter-arrow">▼</span>`;
      toggle.classList.remove("active");
    });
    await renderTodos();
  });
}

function filterTodos(todos) {
  const today = getTodayDateKey();
  const weekEnd = getWeekEndDateKey();
  return todos.filter((t) => {
    if (
      todoFilters.search &&
      !t.text.toLowerCase().includes(todoFilters.search)
    )
      return false;
    if (todoFilters.priority !== "all" && t.priority !== todoFilters.priority)
      return false;
    if (todoFilters.date !== "all") {
      switch (todoFilters.date) {
        case "today":
          if (t.date !== today) return false;
          break;
        case "week":
          if (!t.date || t.date < today || t.date > weekEnd) return false;
          break;
        case "overdue":
          if (!t.date || t.date >= today || t.done) return false;
          break;
        case "undated":
          if (t.date) return false;
          break;
      }
    }
    return true;
  });
}

// ==================== Add Todo ====================
async function addTodo() {
  const input = document.getElementById("todoInput");
  const priority = document.getElementById("todoPriority");
  const dateInput = document.getElementById("todoDate");
  const text = input.value.trim();
  if (!text) return;

  const recurringValues = getRecurringValues();
  await TodosDB.add({
    text,
    priority: priority.value,
    date: dateInput?.value || null,
    done: false,
    ...recurringValues,
  });

  input.value = "";
  resetRecurringDropdown();
  await renderTodos();
  await renderTodayTodos();
  if (typeof renderCalendar === "function") {
    await renderCalendar();
    await renderCalendarList();
  }
  if (typeof renderTodayPage === "function") await renderTodayPage();
}

// ==================== Edit Todo Modal ====================
function initEditTodoModal() {
  const modal = document.getElementById("editTodoModal");
  document.getElementById("closeEditTodoModal").onclick = closeEditTodoModal;
  document.getElementById("cancelEditTodo").onclick = closeEditTodoModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeEditTodoModal();
  };
  document.getElementById("saveEditTodo").onclick = saveEditTodo;
  document.getElementById("editTodoTextInput").onkeypress = (e) => {
    if (e.key === "Enter") saveEditTodo();
  };

  const recurringCheckbox = document.getElementById(
    "editTodoRecurringCheckbox",
  );
  const recurringOptions = document.getElementById("editTodoRecurringOptions");
  recurringCheckbox.addEventListener("change", () => {
    recurringOptions.style.display = recurringCheckbox.checked
      ? "flex"
      : "none";
  });
}

async function openEditTodoModal(todoId) {
  const { data: todo } = await supabaseClient
    .from("todos")
    .select("*")
    .eq("id", todoId)
    .single();
  if (!todo) return;

  editingTodoId = todoId;
  document.getElementById("editTodoTextInput").value = todo.text;
  document.getElementById("editTodoDateInput").value = todo.date || "";
  document.getElementById("editTodoPriorityInput").value = todo.priority;

  const recurringCheckbox = document.getElementById(
    "editTodoRecurringCheckbox",
  );
  const recurringOptions = document.getElementById("editTodoRecurringOptions");
  recurringCheckbox.checked = todo.recurring || false;
  recurringOptions.style.display = todo.recurring ? "flex" : "none";
  document.getElementById("editTodoRecurringType").value =
    todo.recurring_type || "daily";
  document.getElementById("editTodoRecurringInterval").value =
    todo.recurring_interval || 1;

  document.getElementById("editTodoModal").classList.add("active");
  setTimeout(() => document.getElementById("editTodoTextInput").focus(), 100);
}

function closeEditTodoModal() {
  document.getElementById("editTodoModal").classList.remove("active");
  editingTodoId = null;
}

async function saveEditTodo() {
  if (!editingTodoId) return;
  const text = document.getElementById("editTodoTextInput").value.trim();
  if (!text) return;

  const recurring = document.getElementById(
    "editTodoRecurringCheckbox",
  ).checked;
  await TodosDB.update(editingTodoId, {
    text,
    date: document.getElementById("editTodoDateInput").value || null,
    priority: document.getElementById("editTodoPriorityInput").value,
    recurring,
    recurringType: recurring
      ? document.getElementById("editTodoRecurringType").value
      : null,
    recurringInterval: recurring
      ? parseInt(document.getElementById("editTodoRecurringInterval").value) ||
        1
      : 1,
  });

  closeEditTodoModal();
  await renderTodos();
  await renderTodayTodos();
  if (typeof renderCalendar === "function") {
    await renderCalendar();
    await renderCalendarList();
  }
  if (typeof renderTodayPage === "function") await renderTodayPage();

  const viewModal = document.getElementById("viewEventsModal");
  if (
    viewModal?.classList.contains("active") &&
    viewModal.dataset.currentDate &&
    typeof openViewEventsModal === "function"
  ) {
    await openViewEventsModal(viewModal.dataset.currentDate);
  }
}

// ==================== Render Todos ====================
async function renderTodos() {
  const todos = await TodosDB.getAll();
  const filtered = filterTodos(todos);
  const pending = filtered.filter((t) => !t.done);
  const completed = filtered.filter((t) => t.done);

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortFn = (a, b) => {
    if (!a.date && b.date) return -1;
    if (a.date && !b.date) return 1;
    if (a.date && b.date && a.date !== b.date)
      return a.date.localeCompare(b.date);
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  };
  pending.sort(sortFn);
  completed.sort(sortFn);

  renderPendingTodos(pending);
  renderCompletedTodos(completed);
  bindTodoEvents();
}

function renderPendingTodos(pending) {
  const list = document.getElementById("pendingTodoList");
  document.getElementById("pendingCount").textContent = `(${pending.length}개)`;
  if (pending.length === 0) {
    list.innerHTML = `<li class="todo-empty-state"><div class="todo-empty-state-icon">✔</div><div class="todo-empty-state-text">모든 할 일을 완료했습니다!</div></li>`;
    return;
  }
  list.innerHTML = pending.map((t) => renderTodoItem(t, true)).join("");
}

function renderCompletedTodos(completed) {
  const list = document.getElementById("completedTodoList");
  const pagination = document.getElementById("completedPagination");
  document.getElementById("completedCount").textContent =
    `(${completed.length}개)`;

  if (completed.length === 0) {
    list.innerHTML = `<li class="todo-empty-state"><div class="todo-empty-state-icon">📋</div><div class="todo-empty-state-text">완료된 할 일이 없습니다</div></li>`;
    pagination.classList.remove("show");
    return;
  }

  const totalPages = Math.ceil(completed.length / ITEMS_PER_PAGE);
  if (completedPage > totalPages) completedPage = totalPages;
  if (completedPage < 1) completedPage = 1;

  const startIndex = (completedPage - 1) * ITEMS_PER_PAGE;
  list.innerHTML = completed
    .slice(startIndex, startIndex + ITEMS_PER_PAGE)
    .map((t) => renderTodoItem(t, true))
    .join("");

  if (totalPages > 1) {
    pagination.classList.add("show");
    renderPagination(totalPages);
  } else pagination.classList.remove("show");
}

function renderPagination(totalPages) {
  const pagesContainer = document.getElementById("paginationPages");
  const prevBtn = document.getElementById("paginationPrevGroup");
  const nextBtn = document.getElementById("paginationNextGroup");

  const currentGroup = Math.ceil(completedPage / PAGE_GROUP_SIZE);
  const totalGroups = Math.ceil(totalPages / PAGE_GROUP_SIZE);
  const groupStart = (currentGroup - 1) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);

  let pagesHtml = "";
  for (let i = groupStart; i <= groupEnd; i++) {
    pagesHtml += `<button class="pagination-btn ${i === completedPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }
  pagesContainer.innerHTML = pagesHtml;
  prevBtn.disabled = currentGroup === 1;
  nextBtn.disabled = currentGroup === totalGroups;

  pagesContainer.querySelectorAll(".pagination-btn").forEach((btn) => {
    btn.onclick = async () => {
      completedPage = parseInt(btn.dataset.page);
      await renderTodos();
    };
  });
  prevBtn.onclick = async () => {
    if (currentGroup > 1) {
      completedPage = (currentGroup - 2) * PAGE_GROUP_SIZE + 1;
      await renderTodos();
    }
  };
  nextBtn.onclick = async () => {
    if (currentGroup < totalGroups) {
      completedPage = currentGroup * PAGE_GROUP_SIZE + 1;
      await renderTodos();
    }
  };
}

async function renderTodayTodos() {
  const todos = await TodosDB.getTodayAndUndated();
  const todayList = document.getElementById("todayTodoList");
  if (!todayList) return;

  if (todos.length === 0) {
    todayList.innerHTML = `<li class="empty-state"><div class="empty-state-icon">✔</div><div>오늘 할 일이 없습니다</div></li>`;
  } else {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    todayList.innerHTML = todos.map((t) => renderTodoItem(t, false)).join("");
  }

  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const todayTotalEl = document.getElementById("todayTotal");
  const todayDoneEl = document.getElementById("todayDone");
  const todayPercentEl = document.getElementById("todayPercent");
  if (todayTotalEl) todayTotalEl.textContent = total;
  if (todayDoneEl) todayDoneEl.textContent = done;
  if (todayPercentEl)
    todayPercentEl.textContent = total
      ? Math.round((done / total) * 100) + "%"
      : "0%";

  bindTodoEvents();
}

function renderTodoItem(t, showDate = false) {
  const dateLabel = t.date ? formatTodoDate(t.date) : "미지정";
  const dateClass =
    t.date && t.date < getTodayDateKey() && !t.done ? "overdue" : "";
  const dateHtml = showDate
    ? `<span class="todo-date ${dateClass}">${dateLabel}</span>`
    : "";
  const recurringHtml = t.recurring
    ? `<span class="todo-recurring" title="${getRecurringLabel(t.recurring_type, t.recurring_interval)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg></span>`
    : "";

  return `<li class="todo-item ${t.done ? "completed" : ""}" data-id="${t.id}">
    <div class="checkbox ${t.done ? "checked" : ""}" data-id="${t.id}"></div>
    <span class="todo-text" data-id="${t.id}">${escapeHtml(t.text)}</span>
    ${recurringHtml}${dateHtml}
    <span class="todo-priority ${t.priority}">${t.priority}</span>
    <button class="delete-btn" data-id="${t.id}">✕</button>
  </li>`;
}

function getRecurringLabel(type, interval) {
  if (interval === 1)
    return (
      { daily: "매일", weekly: "매주", monthly: "매월", yearly: "매년" }[
        type
      ] || ""
    );
  return `${interval}${{ daily: "일", weekly: "주", monthly: "개월", yearly: "년" }[type] || ""}마다`;
}

// ==================== Bind Events ====================
function bindTodoEvents() {
  document.querySelectorAll(".todo-list .checkbox").forEach((cb) => {
    cb.onclick = async () => {
      await TodosDB.toggle(cb.dataset.id);
      await renderTodos();
      await renderTodayTodos();
      if (typeof renderCalendar === "function") {
        await renderCalendar();
        await renderCalendarList();
      }
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });

  document.querySelectorAll(".todo-list .todo-text").forEach((text) => {
    text.onclick = () => openEditTodoModal(text.dataset.id);
  });

  document.querySelectorAll(".todo-item .delete-btn").forEach((btn) => {
    btn.onclick = async () => {
      await TodosDB.delete(btn.dataset.id);
      await renderTodos();
      await renderTodayTodos();
      if (typeof renderCalendar === "function") {
        await renderCalendar();
        await renderCalendarList();
      }
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });
}

// ==================== Helpers ====================
function getTodayDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getWeekEndDateKey() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + daysUntilSunday);
  return `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
}

function formatTodoDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const today = new Date();
  const todayKey = getTodayDateKey();
  if (dateStr === todayKey) return "오늘";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    dateStr ===
    `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`
  )
    return "내일";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    dateStr ===
    `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
  )
    return "어제";

  return `${month}/${day}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
