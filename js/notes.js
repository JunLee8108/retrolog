// ==================== Notes Module ====================

let selectedNoteColor = "yellow";
let editingNoteId = null;
let searchQuery = "";

// ==================== Initialize ====================
async function initNotes() {
  await renderNotes();
  initNoteModal();
  initNoteSearch();

  document.getElementById("addNoteBtn").addEventListener("click", () => {
    editingNoteId = null;
    openNoteModal();
  });
}

// ==================== Search ====================
function initNoteSearch() {
  const searchInput = document.getElementById("noteSearchInput");

  searchInput.addEventListener("input", async (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    await renderNotes();
  });
}

// ==================== Render Notes ====================
async function renderNotes() {
  const container = document.getElementById("notesGrid");

  // Load from DB
  let notes;
  if (searchQuery) {
    notes = await NotesDB.search(searchQuery);
  } else {
    notes = await NotesDB.getAll();
  }

  // Sort: pinned first, then by updatedAt
  notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  if (notes.length === 0) {
    if (searchQuery) {
      container.innerHTML = `
        <div class="no-results">
          <div>검색 결과가 없습니다</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="notes-empty">
          <div class="notes-empty-icon">✏️</div>
          <div>메모를 추가해보세요</div>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = notes
    .map((note) => {
      const preview =
        note.content.length > 150
          ? note.content.substring(0, 150) + "..."
          : note.content;

      return `
      <div class="note-card color-${note.color}" data-id="${note.id}">
        ${note.pinned ? '<div class="note-pin">📌</div>' : ""}
        <div class="note-actions">
          <button class="note-action-btn pin ${
            note.pinned ? "active" : ""
          }" data-id="${note.id}" title="고정">📌</button>
          <button class="note-action-btn delete" data-id="${
            note.id
          }" title="삭제">🗑</button>
        </div>
        <div class="note-title">${escapeHtml(note.title) || "제목 없음"}</div>
        <div class="note-content">${escapeHtml(preview)}</div>
        <div class="note-date">${formatNoteDate(note.updatedAt)}</div>
      </div>
    `;
    })
    .join("");

  bindNoteEvents();
}

// ==================== Bind Events ====================
function bindNoteEvents() {
  // Click to edit
  document.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".note-actions")) return;
      editingNoteId = card.dataset.id;
      openNoteModal(editingNoteId);
    });
  });

  // Pin toggle
  document.querySelectorAll(".note-action-btn.pin").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await NotesDB.togglePin(btn.dataset.id);
      await renderNotes();
    };
  });

  // Delete
  document.querySelectorAll(".note-action-btn.delete").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm("이 메모를 삭제하시겠습니까?")) {
        await NotesDB.delete(btn.dataset.id);
        await renderNotes();
      }
    };
  });
}

// ==================== Note Modal ====================
function initNoteModal() {
  const modal = document.getElementById("noteModal");

  document.getElementById("closeNoteModal").onclick = closeNoteModal;
  document.getElementById("cancelNote").onclick = closeNoteModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeNoteModal();
  };

  // Color options
  document.querySelectorAll(".note-color-option").forEach((opt) => {
    opt.onclick = () => {
      document
        .querySelectorAll(".note-color-option")
        .forEach((c) => c.classList.remove("selected"));
      opt.classList.add("selected");
      selectedNoteColor = opt.dataset.color;
    };
  });

  document.getElementById("saveNote").onclick = saveNote;
}

async function openNoteModal(noteId = null) {
  const modal = document.getElementById("noteModal");
  const title = document.getElementById("noteModalTitle");
  const titleInput = document.getElementById("noteTitleInput");
  const contentInput = document.getElementById("noteContentInput");
  const pinnedCheckbox = document.getElementById("notePinnedCheckbox");

  if (noteId) {
    const notes = await NotesDB.getAll();
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      title.textContent = "메모 수정";
      titleInput.value = note.title;
      contentInput.value = note.content;
      pinnedCheckbox.checked = note.pinned;
      selectedNoteColor = note.color;
    }
  } else {
    title.textContent = "새 메모";
    titleInput.value = "";
    contentInput.value = "";
    pinnedCheckbox.checked = false;
    selectedNoteColor = "yellow";
  }

  // Update color selection UI
  document.querySelectorAll(".note-color-option").forEach((c) => {
    c.classList.toggle("selected", c.dataset.color === selectedNoteColor);
  });

  modal.classList.add("active");
  setTimeout(() => titleInput.focus(), 100);
}

function closeNoteModal() {
  document.getElementById("noteModal").classList.remove("active");
  editingNoteId = null;
}

async function saveNote() {
  const titleInput = document.getElementById("noteTitleInput");
  const contentInput = document.getElementById("noteContentInput");
  const pinnedCheckbox = document.getElementById("notePinnedCheckbox");

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title && !content) {
    closeNoteModal();
    return;
  }

  if (editingNoteId) {
    await NotesDB.update(editingNoteId, {
      title,
      content,
      color: selectedNoteColor,
      pinned: pinnedCheckbox.checked,
    });
  } else {
    await NotesDB.add({
      title,
      content,
      color: selectedNoteColor,
      pinned: pinnedCheckbox.checked,
    });
  }

  closeNoteModal();
  await renderNotes();
}

// ==================== Helpers ====================
function formatNoteDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  // Today
  if (diff < 24 * 60 * 60 * 1000 && d.getDate() === now.getDate()) {
    return `오늘 ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth()
  ) {
    return "어제";
  }

  // This year
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // Other
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
