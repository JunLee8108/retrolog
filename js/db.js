// ==================== Dexie Database Setup ====================

const db = new Dexie("PlannerDB");

// Schema Definition - Version 5: Added settings table
db.version(5).stores({
  todos:
    "++id, text, done, priority, date, createdAt, recurring, recurringType, recurringInterval",
  events: "++id, date, endDate, text, time, color, allDay",
  goals: "++id, title, type, color, startDate, endDate, createdAt",
  milestones: "++id, goalId, title, completed",
  notes: "++id, title, color, pinned, createdAt, updatedAt",
  settings: "key",
});

// Keep old versions for migration
db.version(4).stores({
  todos:
    "++id, text, done, priority, date, createdAt, recurring, recurringType, recurringInterval",
  events: "++id, date, endDate, text, time, color, allDay",
  goals: "++id, title, type, color, startDate, endDate, createdAt",
  milestones: "++id, goalId, title, completed",
  notes: "++id, title, color, pinned, createdAt, updatedAt",
});

db.version(3).stores({
  todos: "++id, text, done, priority, date, createdAt",
  events: "++id, date, endDate, text, time, color, allDay",
  goals: "++id, title, type, color, startDate, endDate, createdAt",
  milestones: "++id, goalId, title, completed",
  notes: "++id, title, color, pinned, createdAt, updatedAt",
});

// ==================== Helper Functions ====================
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function calculateNextDate(currentDate, type, interval = 1) {
  const date = new Date(currentDate + "T00:00:00");
  switch (type) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7 * interval);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + interval);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
  return formatDateKey(date);
}

// ==================== Settings API ====================
const SettingsDB = {
  async get(key) {
    const setting = await db.settings.get(key);
    return setting ? setting.value : null;
  },

  async set(key, value) {
    await db.settings.put({ key, value });
  },

  async getAll() {
    return await db.settings.toArray();
  },

  async clear() {
    return await db.settings.clear();
  },
};

// ==================== Todos API ====================
const TodosDB = {
  async getAll() {
    return await db.todos.toArray();
  },

  async getByDate(date) {
    return await db.todos.where("date").equals(date).toArray();
  },

  async getUndated() {
    const all = await db.todos.toArray();
    return all.filter((t) => !t.date);
  },

  async getTodayAndUndated() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const all = await db.todos.toArray();
    return all.filter((t) => !t.date || t.date === todayKey);
  },

  async add(todo) {
    return await db.todos.add({
      ...todo,
      recurring: todo.recurring || false,
      recurringType: todo.recurringType || null,
      recurringInterval: todo.recurringInterval || 1,
      createdAt: new Date().toISOString(),
    });
  },

  async update(id, changes) {
    return await db.todos.update(id, changes);
  },

  async delete(id) {
    return await db.todos.delete(id);
  },

  async toggle(id) {
    const todo = await db.todos.get(id);
    if (!todo) return;

    const newDone = !todo.done;
    await db.todos.update(id, { done: newDone });

    // 완료 + 반복 설정 + 날짜 있으면 다음 Todo 생성
    if (newDone && todo.recurring && todo.date && todo.recurringType) {
      const nextDate = calculateNextDate(
        todo.date,
        todo.recurringType,
        todo.recurringInterval || 1
      );

      await db.todos.add({
        text: todo.text,
        priority: todo.priority,
        date: nextDate,
        done: false,
        recurring: true,
        recurringType: todo.recurringType,
        recurringInterval: todo.recurringInterval || 1,
        createdAt: new Date().toISOString(),
      });
    }
  },
};

// ==================== Events API ====================
const EventsDB = {
  async getAll() {
    return await db.events.toArray();
  },

  async getByDate(date) {
    return await db.events.where("date").equals(date).toArray();
  },

  async add(event) {
    return await db.events.add(event);
  },

  async update(id, changes) {
    return await db.events.update(id, changes);
  },

  async delete(id) {
    return await db.events.delete(id);
  },
};

// ==================== Goals API ====================
const GoalsDB = {
  async getAll() {
    const goals = await db.goals.toArray();
    return Promise.all(
      goals.map(async (goal) => ({
        ...goal,
        milestones: await db.milestones
          .where("goalId")
          .equals(goal.id)
          .toArray(),
      }))
    );
  },

  async getByType(type) {
    const goals = await db.goals.where("type").equals(type).toArray();
    return Promise.all(
      goals.map(async (goal) => ({
        ...goal,
        milestones: await db.milestones
          .where("goalId")
          .equals(goal.id)
          .toArray(),
      }))
    );
  },

  async add(goal) {
    return await db.goals.add({
      ...goal,
      createdAt: new Date().toISOString(),
    });
  },

  async update(id, changes) {
    return await db.goals.update(id, changes);
  },

  async delete(id) {
    await db.milestones.where("goalId").equals(id).delete();
    return await db.goals.delete(id);
  },
};

// ==================== Milestones API ====================
const MilestonesDB = {
  async getByGoal(goalId) {
    return await db.milestones.where("goalId").equals(goalId).toArray();
  },

  async add(milestone) {
    return await db.milestones.add(milestone);
  },

  async toggle(id) {
    const milestone = await db.milestones.get(id);
    if (milestone) {
      await db.milestones.update(id, { completed: !milestone.completed });
    }
  },

  async delete(id) {
    return await db.milestones.delete(id);
  },
};

// ==================== Notes API ====================
const NotesDB = {
  async getAll() {
    return await db.notes.orderBy("updatedAt").reverse().toArray();
  },

  async search(query) {
    const all = await db.notes.toArray();
    const q = query.toLowerCase();
    return all.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
    );
  },

  async add(note) {
    const now = new Date().toISOString();
    return await db.notes.add({
      ...note,
      createdAt: now,
      updatedAt: now,
    });
  },

  async update(id, changes) {
    return await db.notes.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id) {
    return await db.notes.delete(id);
  },

  async togglePin(id) {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        pinned: !note.pinned,
        updatedAt: new Date().toISOString(),
      });
    }
  },
};
