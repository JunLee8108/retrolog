// ==================== Settings Module ====================

const APP_VERSION = "1.0.0";
let pendingImportData = null;

// ==================== Initialize ====================
async function initSettings() {
  await loadStartPageSetting();
  await renderStorageUsage();
  bindSettingsEvents();
  bindHelpAccordion();
}

// ==================== Start Page Setting ====================
async function loadStartPageSetting() {
  const startPage = await SettingsDB.get("startPage");
  const select = document.getElementById("startPageSelect");
  if (startPage && select) {
    select.value = startPage;
  }
}

async function saveStartPageSetting(value) {
  await SettingsDB.set("startPage", value);
}

// ==================== Help Accordion ====================
function bindHelpAccordion() {
  document.querySelectorAll(".help-accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const accordion = header.parentElement;
      const isOpen = accordion.classList.contains("open");

      // Close all accordions
      document.querySelectorAll(".help-accordion").forEach((acc) => {
        acc.classList.remove("open");
      });

      // Toggle current
      if (!isOpen) {
        accordion.classList.add("open");
      }
    });
  });
}

// ==================== Storage Usage ====================
async function renderStorageUsage() {
  const todos = await db.todos.count();
  const events = await db.events.count();
  const goals = await db.goals.count();
  const milestones = await db.milestones.count();
  const notes = await db.notes.count();

  // Update counts
  document.getElementById("storageTodos").textContent = `${todos}개`;
  document.getElementById("storageEvents").textContent = `${events}개`;
  document.getElementById(
    "storageGoals"
  ).textContent = `${goals}개 (${milestones} 마일스톤)`;
  document.getElementById("storageNotes").textContent = `${notes}개`;

  // Calculate storage size
  const allData = {
    todos: await db.todos.toArray(),
    events: await db.events.toArray(),
    goals: await db.goals.toArray(),
    milestones: await db.milestones.toArray(),
    notes: await db.notes.toArray(),
  };

  const dataSize = new Blob([JSON.stringify(allData)]).size;
  const maxSize = 50 * 1024 * 1024; // 50MB estimate for IndexedDB
  const percent = Math.min((dataSize / maxSize) * 100, 100);

  document.getElementById("storageBarFill").style.width = `${percent}%`;
  document.getElementById("storageInfo").textContent = `${formatBytes(
    dataSize
  )} 사용 중`;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ==================== Bind Events ====================
function bindSettingsEvents() {
  // Start Page Select
  document.getElementById("startPageSelect").addEventListener("change", (e) => {
    saveStartPageSetting(e.target.value);
  });

  // Export
  document
    .getElementById("exportDataBtn")
    .addEventListener("click", exportData);

  // Import
  document.getElementById("importDataBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });

  document
    .getElementById("importFileInput")
    .addEventListener("change", handleFileSelect);

  // Import Modal
  document
    .getElementById("closeImportModal")
    .addEventListener("click", closeImportModal);
  document
    .getElementById("cancelImport")
    .addEventListener("click", closeImportModal);
  document
    .getElementById("confirmImport")
    .addEventListener("click", confirmImport);
  document
    .getElementById("importConfirmModal")
    .addEventListener("click", (e) => {
      if (e.target.id === "importConfirmModal") closeImportModal();
    });

  // Clear Data
  document
    .getElementById("clearAllDataBtn")
    .addEventListener("click", openClearModal);
  document
    .getElementById("closeClearModal")
    .addEventListener("click", closeClearModal);
  document
    .getElementById("cancelClear")
    .addEventListener("click", closeClearModal);
  document
    .getElementById("confirmClear")
    .addEventListener("click", confirmClearData);
  document.getElementById("clearDataModal").addEventListener("click", (e) => {
    if (e.target.id === "clearDataModal") closeClearModal();
  });

  // Clear confirm input
  document
    .getElementById("clearConfirmInput")
    .addEventListener("input", (e) => {
      const btn = document.getElementById("confirmClear");
      btn.disabled = e.target.value !== "삭제";
    });
}

// ==================== Export Data ====================
async function exportData() {
  const data = {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      todos: await db.todos.toArray(),
      events: await db.events.toArray(),
      goals: await db.goals.toArray(),
      milestones: await db.milestones.toArray(),
      notes: await db.notes.toArray(),
      settings: await db.settings.toArray(),
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(
    today.getMonth() + 1
  ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const filename = `planner_backup_${dateStr}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== Import Data ====================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!validateImportData(data)) {
        alert("유효하지 않은 파일 형식입니다.");
        return;
      }
      pendingImportData = data;
      openImportModal(data);
    } catch (err) {
      alert("파일을 읽는 중 오류가 발생했습니다.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function validateImportData(data) {
  if (!data || !data.data) return false;
  const requiredKeys = ["todos", "events", "goals", "milestones", "notes"];
  return requiredKeys.every((key) => Array.isArray(data.data[key]));
}

function openImportModal(data) {
  const list = document.getElementById("importPreviewList");
  const d = data.data;

  const settingsCount = d.settings ? d.settings.length : 0;

  list.innerHTML = `
    <li><span>할 일</span><span>${d.todos.length}개</span></li>
    <li><span>일정</span><span>${d.events.length}개</span></li>
    <li><span>목표</span><span>${d.goals.length}개</span></li>
    <li><span>마일스톤</span><span>${d.milestones.length}개</span></li>
    <li><span>메모</span><span>${d.notes.length}개</span></li>
    ${
      settingsCount > 0
        ? `<li><span>설정</span><span>${settingsCount}개</span></li>`
        : ""
    }
  `;

  document.getElementById("importConfirmModal").classList.add("active");
}

function closeImportModal() {
  document.getElementById("importConfirmModal").classList.remove("active");
  pendingImportData = null;
}

async function confirmImport() {
  if (!pendingImportData) return;

  const mode = document.querySelector('input[name="importMode"]:checked').value;
  const d = pendingImportData.data;

  try {
    if (mode === "replace") {
      // Clear all then add
      await db.todos.clear();
      await db.events.clear();
      await db.goals.clear();
      await db.milestones.clear();
      await db.notes.clear();
      await db.settings.clear();
    }

    // Bulk add (Dexie handles duplicate keys in merge mode by failing silently)
    if (mode === "merge") {
      // For merge, we add with new IDs
      for (const todo of d.todos) {
        delete todo.id;
        await db.todos.add(todo);
      }
      for (const event of d.events) {
        delete event.id;
        await db.events.add(event);
      }
      for (const goal of d.goals) {
        const oldId = goal.id;
        delete goal.id;
        const newId = await db.goals.add(goal);
        // Update milestones with new goal ID
        const relatedMilestones = d.milestones.filter(
          (m) => m.goalId === oldId
        );
        for (const ms of relatedMilestones) {
          delete ms.id;
          ms.goalId = newId;
          await db.milestones.add(ms);
        }
      }
      for (const note of d.notes) {
        delete note.id;
        await db.notes.add(note);
      }
      // Settings: overwrite existing keys
      if (d.settings && Array.isArray(d.settings)) {
        for (const setting of d.settings) {
          await db.settings.put(setting);
        }
      }
    } else {
      // Replace mode - add with original IDs
      await db.todos.bulkAdd(d.todos);
      await db.events.bulkAdd(d.events);
      await db.goals.bulkAdd(d.goals);
      await db.milestones.bulkAdd(d.milestones);
      await db.notes.bulkAdd(d.notes);
      if (d.settings && Array.isArray(d.settings)) {
        await db.settings.bulkPut(d.settings);
      }
    }

    closeImportModal();
    await refreshAllViews();
    await loadStartPageSetting(); // Refresh start page select
    alert("데이터를 성공적으로 가져왔습니다.");
  } catch (err) {
    console.error("Import error:", err);
    alert("데이터 가져오기 중 오류가 발생했습니다.");
  }
}

// ==================== Clear Data ====================
async function openClearModal() {
  const todos = await db.todos.count();
  const events = await db.events.count();
  const goals = await db.goals.count();
  const milestones = await db.milestones.count();
  const notes = await db.notes.count();

  const list = document.getElementById("clearDataList");
  list.innerHTML = `
    <li>할 일: ${todos}개</li>
    <li>일정: ${events}개</li>
    <li>목표: ${goals}개 (마일스톤 ${milestones}개)</li>
    <li>메모: ${notes}개</li>
  `;

  document.getElementById("clearConfirmInput").value = "";
  document.getElementById("confirmClear").disabled = true;
  document.getElementById("clearDataModal").classList.add("active");
}

function closeClearModal() {
  document.getElementById("clearDataModal").classList.remove("active");
}

async function confirmClearData() {
  const input = document.getElementById("clearConfirmInput").value;
  if (input !== "삭제") return;

  try {
    await db.todos.clear();
    await db.events.clear();
    await db.goals.clear();
    await db.milestones.clear();
    await db.notes.clear();
    await db.settings.clear();

    closeClearModal();
    await refreshAllViews();
    await loadStartPageSetting(); // Reset select to default
    alert("모든 데이터가 삭제되었습니다.");
  } catch (err) {
    console.error("Clear error:", err);
    alert("데이터 삭제 중 오류가 발생했습니다.");
  }
}

// ==================== Refresh All Views ====================
async function refreshAllViews() {
  await renderStorageUsage();

  if (typeof renderTodos === "function") await renderTodos();
  if (typeof renderTodayTodos === "function") await renderTodayTodos();
  if (typeof renderCalendar === "function") {
    await renderCalendar();
    await renderCalendarList();
  }
  if (typeof renderGoals === "function") await renderGoals();
  if (typeof renderNotes === "function") await renderNotes();
  if (typeof renderTodayPage === "function") await renderTodayPage();
}
