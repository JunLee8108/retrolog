// ==================== Calendar Module ====================

let currentDate = new Date();
let selectedDate = null;
let selectedEventColor = "red";
let draggedItemId = null;
let draggedItemDate = null;
let draggedItemType = null;
let editingEventId = null;
let editEventColor = "red";

// ==================== Initialize ====================
async function initCalendar() {
  document.getElementById("prevMonth").onclick = () => goToPrevMonth();
  document.getElementById("nextMonth").onclick = () => goToNextMonth();
  initEventModals();
  initEditEventModal();
  initCalendarKeyboard();
  await renderCalendar();
  await renderCalendarList();
}

// ==================== Keyboard Navigation ====================
function initCalendarKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("calendar").classList.contains("active"))
      return;
    if (document.querySelector(".modal-overlay.active")) return;
    const activeEl = document.activeElement;
    if (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      pressNavButton("prevMonth");
      goToPrevMonth();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pressNavButton("nextMonth");
      goToNextMonth();
    }
  });
}

function pressNavButton(btnId) {
  const btn = document.getElementById(btnId);
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 150);
}

// ==================== Month Navigation ====================
function goToPrevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
  renderCalendarList();
}

function goToNextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
  renderCalendarList();
}

// ==================== Helper Functions ====================
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    dates.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ==================== Build Calendar Grid Data ====================
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  const grid = [];
  let currentWeek = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    currentWeek.push({
      date: prevLastDate - i,
      dateKey: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(
        prevLastDate - i
      ).padStart(2, "0")}`,
      otherMonth: true,
    });
  }

  // Current month days
  for (let d = 1; d <= lastDate; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    currentWeek.push({ date: d, dateKey, otherMonth: false });

    if (currentWeek.length === 7) {
      grid.push(currentWeek);
      currentWeek = [];
    }
  }

  // Next month days
  if (currentWeek.length > 0) {
    let nextDay = 1;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    while (currentWeek.length < 7) {
      currentWeek.push({
        date: nextDay,
        dateKey: `${nextYear}-${String(nextMonth + 1).padStart(
          2,
          "0"
        )}-${String(nextDay).padStart(2, "0")}`,
        otherMonth: true,
      });
      nextDay++;
    }
    grid.push(currentWeek);
  }

  return grid;
}

// ==================== Process Multi-day Events for Week ====================
function processMultiDayEventsForWeek(events, weekDates) {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const weekEvents = events.filter((ev) => {
    if (!ev.allDay || !ev.endDate) return false;
    return ev.date <= weekEnd && ev.endDate >= weekStart;
  });

  weekEvents.sort((a, b) => {
    const durationA = getDatesBetween(a.date, a.endDate).length;
    const durationB = getDatesBetween(b.date, b.endDate).length;
    if (durationB !== durationA) return durationB - durationA;
    return a.date.localeCompare(b.date);
  });

  const rows = [];

  weekEvents.forEach((event) => {
    const eventStart = event.date < weekStart ? weekStart : event.date;
    const eventEnd = event.endDate > weekEnd ? weekEnd : event.endDate;

    const startIdx = weekDates.indexOf(eventStart);
    const endIdx = weekDates.indexOf(eventEnd);

    let rowIdx = 0;
    while (true) {
      if (!rows[rowIdx]) {
        rows[rowIdx] = [];
        break;
      }

      const hasOverlap = rows[rowIdx].some((e) => {
        return !(e.endIdx < startIdx || e.startIdx > endIdx);
      });

      if (!hasOverlap) break;
      rowIdx++;
    }

    rows[rowIdx].push({
      event,
      startIdx,
      endIdx,
      isStart: event.date >= weekStart,
      isEnd: event.endDate <= weekEnd,
    });
  });

  return rows;
}

// ==================== Render Calendar ====================
async function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  document.getElementById("calendarTitle").textContent = `${year}년 ${
    month + 1
  }월`;

  const today = new Date();
  const todayKey = formatDateKey(today);

  const grid = buildCalendarGrid(year, month);

  const allEvents = await EventsDB.getAll();
  const allTodos = await TodosDB.getAll();

  const multiDayEvents = allEvents.filter(
    (ev) => ev.allDay && ev.endDate && ev.endDate !== ev.date
  );
  const singleDayEvents = allEvents.filter(
    (ev) => !ev.allDay || !ev.endDate || ev.endDate === ev.date
  );

  // Build data by date
  const dataByDate = {};
  singleDayEvents.forEach((ev) => {
    if (!dataByDate[ev.date]) dataByDate[ev.date] = { events: [], todos: [] };
    dataByDate[ev.date].events.push(ev);
  });
  allTodos.forEach((todo) => {
    if (todo.date) {
      if (!dataByDate[todo.date])
        dataByDate[todo.date] = { events: [], todos: [] };
      dataByDate[todo.date].todos.push(todo);
    }
  });

  let html = "";

  grid.forEach((week) => {
    const weekDates = week.map((d) => d.dateKey);
    const multiDayRows = processMultiDayEventsForWeek(
      multiDayEvents,
      weekDates
    );
    const multiDayRowCount = multiDayRows.length;

    // Calculate multi-day count per day
    const multiDayCountPerDay = {};
    weekDates.forEach((date) => {
      multiDayCountPerDay[date] = 0;
    });

    multiDayRows.forEach((row, rowIdx) => {
      row.forEach((item) => {
        for (let i = item.startIdx; i <= item.endIdx; i++) {
          multiDayCountPerDay[weekDates[i]] = Math.max(
            multiDayCountPerDay[weekDates[i]],
            rowIdx + 1
          );
        }
      });
    });

    // Render multi-day events layer
    let multiDayHtml = "";
    if (multiDayRowCount > 0) {
      multiDayRows.forEach((row) => {
        let rowHtml = '<div class="multi-day-row">';
        row.forEach((item) => {
          const cellWidth = 100 / 7;
          const paddingPercent = 0.563;

          let leftPercent = item.startIdx * cellWidth;
          let rightPercent = (6 - item.endIdx) * cellWidth;

          if (item.isStart) leftPercent += paddingPercent;
          if (item.isEnd) rightPercent += paddingPercent;

          const text = item.isStart ? item.event.text : "";

          rowHtml += `<div class="multi-day-bar ${item.event.color}" 
            style="left: ${leftPercent}%; right: ${rightPercent}%;"
            draggable="true"
            data-type="event"
            data-id="${item.event.id}"
            data-date="${item.event.date}">${text}</div>`;
        });
        rowHtml += "</div>";
        multiDayHtml += rowHtml;
      });
    }

    if (multiDayHtml) {
      html += `<div class="cal-week-wrapper">`;
      html += `<div class="multi-day-layer">${multiDayHtml}</div>`;
    }

    html += `<div class="cal-week">`;

    week.forEach((day) => {
      const isToday = day.dateKey === todayKey;
      const dayData = dataByDate[day.dateKey] || { events: [], todos: [] };
      const dayMultiDayCount = multiDayCountPerDay[day.dateKey] || 0;
      const maxShow = Math.max(0, 3 - dayMultiDayCount);

      let itemsHtml = "";

      if (dayMultiDayCount > 0) {
        itemsHtml += `<div class="multi-day-spacer"></div>`;
      }

      const events = [...dayData.events].sort((a, b) =>
        (a.time || "").localeCompare(b.time || "")
      );
      const todos = [...dayData.todos].sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 };
        return p[a.priority] - p[b.priority];
      });

      const items = [
        ...events.map((ev) => ({ ...ev, itemType: "event" })),
        ...todos.map((t) => ({ ...t, itemType: "todo" })),
      ];

      const showCount = Math.min(items.length, maxShow);
      items.slice(0, showCount).forEach((item) => {
        if (item.itemType === "event") {
          const timeStr = item.time ? item.time + " " : item.allDay ? "" : "";
          itemsHtml += `<div class="event-bar ${item.color}" draggable="true" data-type="event" data-date="${day.dateKey}" data-id="${item.id}">${timeStr}${item.text}</div>`;
        } else {
          const priorityIcon =
            item.priority === "high"
              ? '<span class="todo-priority-icon">!</span>'
              : "";
          itemsHtml += `<div class="todo-bar ${
            item.done ? "done" : ""
          }" draggable="true" data-type="todo" data-date="${
            day.dateKey
          }" data-id="${item.id}">
            <span class="todo-check">${
              item.done ? "✔" : "○"
            }</span>${priorityIcon}<span class="todo-bar-text">${
            item.text
          }</span>
          </div>`;
        }
      });

      if (items.length > maxShow) {
        itemsHtml += `<div class="more-events" data-date="${day.dateKey}">${
          items.length - maxShow
        }개 더보기</div>`;
      }

      html += `
        <div class="cal-day ${day.otherMonth ? "other-month" : ""} ${
        isToday ? "today" : ""
      }" data-date="${day.dateKey}">
          <span class="day-number">${day.date}</span>
          <div class="day-events">${itemsHtml}</div>
        </div>
      `;
    });

    html += `</div>`;

    if (multiDayHtml) {
      html += `</div>`;
    }
  });

  document.getElementById("calendarDays").innerHTML = html;
  bindCalendarEvents();
}

// ==================== Bind Events ====================
function bindCalendarEvents() {
  // Day cell events
  document.querySelectorAll(".cal-day:not(.other-month)").forEach((day) => {
    // Double click to add event
    day.addEventListener("dblclick", (e) => {
      if (
        e.target.closest(".event-bar") ||
        e.target.closest(".todo-bar") ||
        e.target.closest(".more-events") ||
        e.target.closest(".multi-day-bar")
      )
        return;
      const [y, m, d] = day.dataset.date.split("-").map(Number);
      selectedDate = new Date(y, m - 1, d);
      openAddEventModal();
    });

    // Drag over
    day.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (
        !day.classList.contains("other-month") &&
        day.dataset.date !== draggedItemDate
      ) {
        day.classList.add("drag-over");
      }
    });

    // Drag leave
    day.addEventListener("dragleave", (e) => {
      const rect = day.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        day.classList.remove("drag-over");
      }
    });

    // Drop
    day.addEventListener("drop", async (e) => {
      e.preventDefault();
      day.classList.remove("drag-over");
      if (day.classList.contains("other-month") || !draggedItemId) return;

      const newDate = day.dataset.date;
      if (newDate === draggedItemDate) return;

      if (draggedItemType === "event") {
        const event = await db.events.get(draggedItemId);
        if (event && event.endDate && event.endDate !== event.date) {
          const oldStart = new Date(event.date + "T00:00:00");
          const oldEnd = new Date(event.endDate + "T00:00:00");
          const duration = Math.round(
            (oldEnd - oldStart) / (1000 * 60 * 60 * 24)
          );

          const newStart = new Date(newDate + "T00:00:00");
          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + duration);

          await EventsDB.update(draggedItemId, {
            date: newDate,
            endDate: formatDateKey(newEnd),
          });
        } else {
          await EventsDB.update(draggedItemId, { date: newDate });
        }
      } else if (draggedItemType === "todo") {
        await TodosDB.update(draggedItemId, { date: newDate });
        await renderTodayTodos();
        await renderTodos();
        if (typeof renderTodayPage === "function") await renderTodayPage();
      }

      await renderCalendar();
      await renderCalendarList();
    });
  });

  // Multi-day bar events
  document.querySelectorAll(".multi-day-bar").forEach((bar) => {
    bar.addEventListener("dragstart", (e) => {
      draggedItemId = Number(bar.dataset.id);
      draggedItemDate = bar.dataset.date;
      draggedItemType = "event";
      bar.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    bar.addEventListener("dragend", () => {
      bar.classList.remove("dragging");
      draggedItemId = null;
      draggedItemDate = null;
      draggedItemType = null;
      document
        .querySelectorAll(".cal-day.drag-over")
        .forEach((d) => d.classList.remove("drag-over"));
    });

    bar.onclick = (e) => {
      e.stopPropagation();
      openViewEventsModal(bar.dataset.date);
    };
  });

  // Event bar events
  document.querySelectorAll(".event-bar").forEach((bar) => {
    bar.addEventListener("dragstart", (e) => {
      draggedItemId = Number(bar.dataset.id);
      draggedItemDate = bar.dataset.date;
      draggedItemType = "event";
      bar.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    bar.addEventListener("dragend", () => {
      bar.classList.remove("dragging");
      draggedItemId = null;
      draggedItemDate = null;
      draggedItemType = null;
      document
        .querySelectorAll(".cal-day.drag-over")
        .forEach((d) => d.classList.remove("drag-over"));
    });

    bar.onclick = (e) => {
      e.stopPropagation();
      openViewEventsModal(bar.dataset.date);
    };
  });

  // Todo bar events
  document.querySelectorAll(".todo-bar").forEach((bar) => {
    bar.addEventListener("dragstart", (e) => {
      draggedItemId = Number(bar.dataset.id);
      draggedItemDate = bar.dataset.date;
      draggedItemType = "todo";
      bar.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    bar.addEventListener("dragend", () => {
      bar.classList.remove("dragging");
      draggedItemId = null;
      draggedItemDate = null;
      draggedItemType = null;
      document
        .querySelectorAll(".cal-day.drag-over")
        .forEach((d) => d.classList.remove("drag-over"));
    });

    const check = bar.querySelector(".todo-check");
    if (check) {
      check.onclick = async (e) => {
        e.stopPropagation();
        await TodosDB.toggle(Number(bar.dataset.id));
        await renderCalendar();
        await renderCalendarList();
        await renderTodayTodos();
        await renderTodos();
        if (typeof renderTodayPage === "function") await renderTodayPage();
      };
    }

    bar.onclick = (e) => {
      if (e.target.classList.contains("todo-check")) return;
      e.stopPropagation();
      openViewEventsModal(bar.dataset.date);
    };
  });

  // More events link
  document.querySelectorAll(".more-events").forEach((more) => {
    more.onclick = (e) => {
      e.stopPropagation();
      openViewEventsModal(more.dataset.date);
    };
  });
}

// ==================== Event Modals ====================
function initEventModals() {
  const addModal = document.getElementById("addEventModal");
  const viewModal = document.getElementById("viewEventsModal");
  const allDayCheckbox = document.getElementById("eventAllDayCheckbox");
  const timeRow = document.getElementById("eventTimeRow");
  const endDateRow = document.getElementById("eventEndDateRow");

  allDayCheckbox.addEventListener("change", () => {
    if (allDayCheckbox.checked) {
      timeRow.style.display = "none";
      endDateRow.style.display = "flex";
    } else {
      timeRow.style.display = "flex";
      endDateRow.style.display = "none";
    }
  });

  document.getElementById("closeAddModal").onclick = closeAddEventModal;
  document.getElementById("cancelAddEvent").onclick = closeAddEventModal;
  addModal.onclick = (e) => {
    if (e.target === addModal) closeAddEventModal();
  };
  document.getElementById("saveEvent").onclick = saveEvent;
  document.getElementById("eventTitleInput").onkeypress = (e) => {
    if (e.key === "Enter") saveEvent();
  };

  document.querySelectorAll("#addEventModal .color-option").forEach((opt) => {
    opt.onclick = () => {
      document
        .querySelectorAll("#addEventModal .color-option")
        .forEach((c) => c.classList.remove("selected"));
      opt.classList.add("selected");
      selectedEventColor = opt.dataset.color;
    };
  });

  document.getElementById("closeViewModal").onclick = closeViewEventsModal;
  document.getElementById("closeViewBtn").onclick = closeViewEventsModal;
  viewModal.onclick = (e) => {
    if (e.target === viewModal) closeViewEventsModal();
  };
}

function openAddEventModal() {
  const dateKey = formatDateKey(selectedDate);
  document.getElementById("addEventTitle").textContent = `${
    selectedDate.getMonth() + 1
  }월 ${selectedDate.getDate()}일 일정 추가`;
  document.getElementById("eventTitleInput").value = "";
  document.getElementById("eventTimeInput").value = "";
  document.getElementById("eventAllDayCheckbox").checked = false;
  document.getElementById("eventEndDateInput").value = "";
  document.getElementById("eventTimeRow").style.display = "flex";
  document.getElementById("eventEndDateRow").style.display = "none";
  document.getElementById("eventEndDateInput").min = dateKey;

  selectedEventColor = "red";
  document
    .querySelectorAll("#addEventModal .color-option")
    .forEach((c) => c.classList.remove("selected"));
  document
    .querySelector("#addEventModal .color-option.red")
    .classList.add("selected");
  document.getElementById("addEventModal").classList.add("active");
  setTimeout(() => document.getElementById("eventTitleInput").focus(), 100);
}

function closeAddEventModal() {
  document.getElementById("addEventModal").classList.remove("active");
}

async function saveEvent() {
  const text = document.getElementById("eventTitleInput").value.trim();
  if (!text) return;

  const allDay = document.getElementById("eventAllDayCheckbox").checked;
  const dateKey = formatDateKey(selectedDate);
  let endDate = null;

  if (allDay) {
    const endDateValue = document.getElementById("eventEndDateInput").value;
    if (endDateValue && endDateValue > dateKey) {
      endDate = endDateValue;
    }
  }

  await EventsDB.add({
    date: dateKey,
    endDate: endDate,
    text,
    time: allDay
      ? null
      : document.getElementById("eventTimeInput").value || null,
    color: selectedEventColor,
    allDay: allDay,
  });

  closeAddEventModal();
  await renderCalendar();
  await renderCalendarList();
  if (typeof renderTodayPage === "function") await renderTodayPage();
}

async function openViewEventsModal(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  document.getElementById("viewEventsTitle").textContent = `${m}월 ${d}일`;

  // Store current date for refresh after edit
  const viewModal = document.getElementById("viewEventsModal");
  viewModal.dataset.currentDate = dateKey;

  const allEvents = await EventsDB.getAll();
  const dayEvents = allEvents.filter((ev) => {
    if (ev.date === dateKey) return true;
    if (ev.endDate && ev.date <= dateKey && ev.endDate >= dateKey) return true;
    return false;
  });

  const dayTodos = await TodosDB.getByDate(dateKey);

  const sortedEvents = [...dayEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.time || "").localeCompare(b.time || "");
  });

  const sortedTodos = [...dayTodos].sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  let html = "";

  if (sortedEvents.length > 0) {
    html += `<div class="view-section-title">일정</div>`;
    html += sortedEvents
      .map((ev) => {
        const timeDisplay = ev.allDay ? "하루 종일" : ev.time || "--:--";
        const dateRange =
          ev.endDate && ev.endDate !== ev.date
            ? ` (${formatDateRange(ev.date, ev.endDate)})`
            : "";
        return `
        <div class="event-list-item">
          <div class="event-color-dot" style="background: var(--${ev.color})"></div>
          <span class="event-list-time">${timeDisplay}</span>
          <span class="event-list-text event-text-clickable" data-id="${ev.id}">${ev.text}${dateRange}</span>
          <button class="event-list-delete" data-type="event" data-date="${dateKey}" data-id="${ev.id}">✕</button>
        </div>
      `;
      })
      .join("");
  }

  if (sortedTodos.length > 0) {
    html += `<div class="view-section-title" style="margin-top: 16px;">할 일</div>`;
    html += sortedTodos
      .map(
        (t) => `
      <div class="event-list-item todo-list-item ${t.done ? "completed" : ""}">
        <div class="todo-list-checkbox ${t.done ? "checked" : ""}" data-id="${
          t.id
        }"></div>
        <span class="event-list-text todo-text-clickable" data-id="${t.id}">${
          t.text
        }</span>
        <span class="todo-priority ${t.priority}">${t.priority}</span>
        <button class="event-list-delete" data-type="todo" data-date="${dateKey}" data-id="${
          t.id
        }">✕</button>
      </div>
    `
      )
      .join("");
  }

  if (!html) {
    html = '<div class="empty-state">일정이 없습니다</div>';
  }

  document.getElementById("viewEventsList").innerHTML = html;

  // Delete button events
  document.querySelectorAll(".event-list-delete").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.type === "event") {
        await EventsDB.delete(Number(btn.dataset.id));
      } else {
        await TodosDB.delete(Number(btn.dataset.id));
        await renderTodayTodos();
        await renderTodos();
      }
      await renderCalendar();
      await renderCalendarList();
      if (typeof renderTodayPage === "function") await renderTodayPage();
      await openViewEventsModal(btn.dataset.date);
    };
  });

  // Todo checkbox events
  document.querySelectorAll(".todo-list-checkbox").forEach((cb) => {
    cb.onclick = async () => {
      await TodosDB.toggle(Number(cb.dataset.id));
      await renderCalendar();
      await renderCalendarList();
      await renderTodayTodos();
      await renderTodos();
      if (typeof renderTodayPage === "function") await renderTodayPage();
      await openViewEventsModal(dateKey);
    };
  });

  // Todo text click to edit
  document.querySelectorAll(".todo-text-clickable").forEach((text) => {
    text.onclick = () => {
      if (typeof openEditTodoModal === "function") {
        openEditTodoModal(Number(text.dataset.id));
      }
    };
  });

  // Event text click to edit
  document.querySelectorAll(".event-text-clickable").forEach((text) => {
    text.onclick = () => {
      openEditEventModal(Number(text.dataset.id));
    };
  });

  viewModal.classList.add("active");
}

function closeViewEventsModal() {
  document.getElementById("viewEventsModal").classList.remove("active");
}

function formatDateRange(startDate, endDate) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  return `${sm}/${sd} - ${em}/${ed}`;
}

// ==================== Edit Event Modal ====================
function initEditEventModal() {
  const modal = document.getElementById("editEventModal");
  const allDayCheckbox = document.getElementById("editEventAllDayCheckbox");
  const timeRow = document.getElementById("editEventTimeRow");
  const endDateRow = document.getElementById("editEventEndDateRow");

  allDayCheckbox.addEventListener("change", () => {
    if (allDayCheckbox.checked) {
      timeRow.style.display = "none";
      endDateRow.style.display = "flex";
    } else {
      timeRow.style.display = "flex";
      endDateRow.style.display = "none";
    }
  });

  document.getElementById("closeEditEventModal").onclick = closeEditEventModal;
  document.getElementById("cancelEditEvent").onclick = closeEditEventModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeEditEventModal();
  };

  document.getElementById("saveEditEvent").onclick = saveEditEvent;
  document.getElementById("editEventTitleInput").onkeypress = (e) => {
    if (e.key === "Enter") saveEditEvent();
  };

  // Color options
  document
    .querySelectorAll("#editEventColorOptions .color-option")
    .forEach((opt) => {
      opt.onclick = () => {
        document
          .querySelectorAll("#editEventColorOptions .color-option")
          .forEach((c) => c.classList.remove("selected"));
        opt.classList.add("selected");
        editEventColor = opt.dataset.color;
      };
    });
}

async function openEditEventModal(eventId) {
  const event = await db.events.get(eventId);
  if (!event) return;

  editingEventId = eventId;
  editEventColor = event.color;

  document.getElementById("editEventTitleInput").value = event.text;
  document.getElementById("editEventDateInput").value = event.date;
  document.getElementById("editEventAllDayCheckbox").checked =
    event.allDay || false;
  document.getElementById("editEventTimeInput").value = event.time || "";
  document.getElementById("editEventEndDateInput").value = event.endDate || "";
  document.getElementById("editEventEndDateInput").min = event.date;

  // Show/hide time and end date rows
  if (event.allDay) {
    document.getElementById("editEventTimeRow").style.display = "none";
    document.getElementById("editEventEndDateRow").style.display = "flex";
  } else {
    document.getElementById("editEventTimeRow").style.display = "flex";
    document.getElementById("editEventEndDateRow").style.display = "none";
  }

  // Update color selection
  document
    .querySelectorAll("#editEventColorOptions .color-option")
    .forEach((c) => {
      c.classList.toggle("selected", c.dataset.color === event.color);
    });

  document.getElementById("editEventModal").classList.add("active");
  setTimeout(() => document.getElementById("editEventTitleInput").focus(), 100);
}

function closeEditEventModal() {
  document.getElementById("editEventModal").classList.remove("active");
  editingEventId = null;
}

async function saveEditEvent() {
  if (!editingEventId) return;

  const text = document.getElementById("editEventTitleInput").value.trim();
  if (!text) return;

  const date = document.getElementById("editEventDateInput").value;
  if (!date) return;

  const allDay = document.getElementById("editEventAllDayCheckbox").checked;
  const time = allDay
    ? null
    : document.getElementById("editEventTimeInput").value || null;

  let endDate = null;
  if (allDay) {
    const endDateValue = document.getElementById("editEventEndDateInput").value;
    if (endDateValue && endDateValue > date) {
      endDate = endDateValue;
    }
  }

  await EventsDB.update(editingEventId, {
    text,
    date,
    endDate,
    time,
    allDay,
    color: editEventColor,
  });

  closeEditEventModal();

  // Refresh all views
  await renderCalendar();
  await renderCalendarList();
  if (typeof renderTodayPage === "function") await renderTodayPage();

  // Refresh viewEventsModal if it's open
  const viewModal = document.getElementById("viewEventsModal");
  if (viewModal && viewModal.classList.contains("active")) {
    const currentDate = viewModal.dataset.currentDate;
    if (currentDate) {
      await openViewEventsModal(currentDate);
    }
  }
}

// ==================== Calendar List View (Mobile) ====================
async function renderCalendarList() {
  const container = document.getElementById("calendarList");
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const weekdays = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];

  const allEvents = await EventsDB.getAll();
  const allTodos = await TodosDB.getAll();

  const dataByDate = {};

  allEvents.forEach((ev) => {
    const dates = ev.endDate ? getDatesBetween(ev.date, ev.endDate) : [ev.date];
    dates.forEach((date) => {
      if (!dataByDate[date]) dataByDate[date] = { events: [], todos: [] };
      if (!dataByDate[date].events.find((e) => e.id === ev.id)) {
        dataByDate[date].events.push(ev);
      }
    });
  });

  allTodos.forEach((t) => {
    if (t.date) {
      if (!dataByDate[t.date]) dataByDate[t.date] = { events: [], todos: [] };
      dataByDate[t.date].todos.push(t);
    }
  });

  let html = "";

  for (let d = 1; d <= lastDate; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay();
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;
    const dayData = dataByDate[dateKey] || { events: [], todos: [] };

    const sortedEvents = [...dayData.events].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return (a.time || "").localeCompare(b.time || "");
    });

    const sortedTodos = [...dayData.todos].sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });

    let dayClass = "day-card";
    if (isToday) dayClass += " is-today";
    if (dayOfWeek === 0) dayClass += " is-sunday";
    if (dayOfWeek === 6) dayClass += " is-saturday";

    let itemsHtml = "";

    sortedEvents.forEach((ev) => {
      const timeDisplay = ev.allDay ? "종일" : ev.time || "";
      const isMultiDay = ev.endDate && ev.endDate !== ev.date;
      const dateRange = isMultiDay
        ? ` (${formatDateRange(ev.date, ev.endDate)})`
        : "";

      itemsHtml += `
        <div class="day-card-event ${ev.color}" data-id="${ev.id}" data-date="${
        ev.date
      }">
          ${
            timeDisplay
              ? `<span class="day-card-event-time">${timeDisplay}</span>`
              : ""
          }
          <span class="day-card-event-text" data-id="${ev.id}">${
        ev.text
      }${dateRange}</span>
        </div>
      `;
    });

    sortedTodos.forEach((t) => {
      itemsHtml += `
        <div class="day-card-todo ${t.done ? "done" : ""}" data-id="${
        t.id
      }" data-date="${dateKey}">
          <span class="day-card-todo-check" data-id="${t.id}">${
        t.done ? "✔" : "○"
      }</span>
          <span class="day-card-todo-text" data-id="${t.id}">${t.text}</span>
          <span class="todo-priority ${t.priority}">${t.priority}</span>
        </div>
      `;
    });

    html += `
      <div class="${dayClass}" data-date="${dateKey}">
        <div class="day-card-header">
          <span class="day-card-date">${d}</span>
          <span class="day-card-weekday">${weekdays[dayOfWeek]}</span>
          ${isToday ? '<span class="day-card-today-badge">오늘</span>' : ""}
        </div>
        <div class="day-card-body">
          <div class="day-card-events">
            ${itemsHtml || '<div class="day-card-empty">일정 없음</div>'}
          </div>
          <div class="day-card-add">
            <button class="day-card-add-btn" data-date="${dateKey}">+ 추가</button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  bindCalendarListEvents();
}

function bindCalendarListEvents() {
  // Add button
  document.querySelectorAll(".day-card-add-btn").forEach((btn) => {
    btn.onclick = () => {
      const [y, m, d] = btn.dataset.date.split("-").map(Number);
      selectedDate = new Date(y, m - 1, d);
      openAddEventModal();
    };
  });

  // Event click - open edit modal
  document.querySelectorAll(".day-card-event").forEach((ev) => {
    ev.onclick = (e) => {
      // Click on event text to edit
      if (e.target.classList.contains("day-card-event-text")) {
        openEditEventModal(Number(e.target.dataset.id));
        return;
      }
      openViewEventsModal(ev.dataset.date);
    };
  });

  // Todo click
  document.querySelectorAll(".day-card-todo").forEach((t) => {
    t.onclick = (e) => {
      if (e.target.classList.contains("day-card-todo-check")) return;
      // Click on todo text to edit
      if (e.target.classList.contains("day-card-todo-text")) {
        if (typeof openEditTodoModal === "function") {
          openEditTodoModal(Number(e.target.dataset.id));
        }
        return;
      }
      openViewEventsModal(t.dataset.date);
    };
  });

  // Todo checkbox
  document.querySelectorAll(".day-card-todo-check").forEach((check) => {
    check.onclick = async (e) => {
      e.stopPropagation();
      await TodosDB.toggle(Number(check.dataset.id));
      await renderCalendar();
      await renderCalendarList();
      await renderTodayTodos();
      await renderTodos();
      if (typeof renderTodayPage === "function") await renderTodayPage();
    };
  });
}
