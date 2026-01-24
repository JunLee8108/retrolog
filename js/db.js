// ==================== Supabase Database API ====================

// ==================== Helper Functions ====================
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function getUserId() {
  const user = getCurrentUser();
  return user?.id;
}

// ==================== Settings API ====================
const SettingsDB = {
  async get(key) {
    const userId = getUserId();
    if (!userId) return null;

    const { data, error } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .single();

    if (error || !data) return null;
    return data.value;
  },

  async set(key, value) {
    const userId = getUserId();
    if (!userId) return;

    const { error } = await supabaseClient
      .from("settings")
      .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });

    if (error) console.error("Settings set error:", error);
  },

  async getAll() {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("settings")
      .select("*")
      .eq("user_id", userId);

    return data || [];
  },

  async clear() {
    const userId = getUserId();
    if (!userId) return;

    await supabaseClient.from("settings").delete().eq("user_id", userId);
  },
};

// ==================== Todos API ====================
const TodosDB = {
  async getAll() {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Todos getAll error:", error);
      return [];
    }
    return data || [];
  },

  async getByDate(date) {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date);

    return data || [];
  },

  async getUndated() {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .is("date", null);

    return data || [];
  },

  async getTodayAndUndated() {
    const userId = getUserId();
    if (!userId) return [];

    const todayKey = formatDateKey(new Date());
    const { data, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .or(`date.eq.${todayKey},date.is.null`);

    return data || [];
  },

  async add(todo) {
    const userId = getUserId();
    if (!userId) return null;

    const { data, error } = await supabaseClient
      .from("todos")
      .insert({
        user_id: userId,
        text: todo.text,
        done: todo.done || false,
        priority: todo.priority || "low",
        date: todo.date || null,
        recurring: todo.recurring || false,
        recurring_type: todo.recurringType || null,
        recurring_interval: todo.recurringInterval || 1,
      })
      .select()
      .single();

    if (error) {
      console.error("Todos add error:", error);
      return null;
    }
    return data;
  },

  async update(id, changes) {
    const updateData = {};
    if (changes.text !== undefined) updateData.text = changes.text;
    if (changes.done !== undefined) updateData.done = changes.done;
    if (changes.priority !== undefined) updateData.priority = changes.priority;
    if (changes.date !== undefined) updateData.date = changes.date;
    if (changes.recurring !== undefined)
      updateData.recurring = changes.recurring;
    if (changes.recurringType !== undefined)
      updateData.recurring_type = changes.recurringType;
    if (changes.recurringInterval !== undefined)
      updateData.recurring_interval = changes.recurringInterval;

    const { error } = await supabaseClient
      .from("todos")
      .update(updateData)
      .eq("id", id);

    if (error) console.error("Todos update error:", error);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("todos").delete().eq("id", id);
    if (error) console.error("Todos delete error:", error);
  },

  async toggle(id) {
    const { data: todo, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !todo) return;

    const newDone = !todo.done;
    await supabaseClient.from("todos").update({ done: newDone }).eq("id", id);

    // 반복 할 일 처리
    if (newDone && todo.recurring && todo.date && todo.recurring_type) {
      const nextDate = calculateNextDate(
        todo.date,
        todo.recurring_type,
        todo.recurring_interval || 1,
      );
      await this.add({
        text: todo.text,
        priority: todo.priority,
        date: nextDate,
        done: false,
        recurring: true,
        recurringType: todo.recurring_type,
        recurringInterval: todo.recurring_interval || 1,
      });
    }
  },
};

// ==================== Events API ====================
const EventsDB = {
  async getAll() {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Events getAll error:", error);
      return [];
    }

    // 컬럼명 변환 (snake_case -> camelCase)
    return (data || []).map((e) => ({
      ...e,
      endDate: e.end_date,
      allDay: e.all_day,
    }));
  },

  async getByDate(date) {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date);

    return (data || []).map((e) => ({
      ...e,
      endDate: e.end_date,
      allDay: e.all_day,
    }));
  },

  async add(event) {
    const userId = getUserId();
    if (!userId) return null;

    const { data, error } = await supabaseClient
      .from("events")
      .insert({
        user_id: userId,
        date: event.date,
        end_date: event.endDate || null,
        text: event.text,
        time: event.time || null,
        color: event.color || "red",
        all_day: event.allDay || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Events add error:", error);
      return null;
    }
    return { ...data, endDate: data.end_date, allDay: data.all_day };
  },

  async update(id, changes) {
    const updateData = {};
    if (changes.date !== undefined) updateData.date = changes.date;
    if (changes.endDate !== undefined) updateData.end_date = changes.endDate;
    if (changes.text !== undefined) updateData.text = changes.text;
    if (changes.time !== undefined) updateData.time = changes.time;
    if (changes.color !== undefined) updateData.color = changes.color;
    if (changes.allDay !== undefined) updateData.all_day = changes.allDay;

    const { error } = await supabaseClient
      .from("events")
      .update(updateData)
      .eq("id", id);
    if (error) console.error("Events update error:", error);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("events").delete().eq("id", id);
    if (error) console.error("Events delete error:", error);
  },
};

// ==================== Goals API ====================
const GoalsDB = {
  async getAll() {
    const userId = getUserId();
    if (!userId) return [];

    const { data: goals, error } = await supabaseClient
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !goals) return [];

    // 각 goal의 milestones 가져오기
    const goalsWithMilestones = await Promise.all(
      goals.map(async (goal) => {
        const { data: milestones } = await supabaseClient
          .from("milestones")
          .select("*")
          .eq("goal_id", goal.id);

        return {
          ...goal,
          startDate: goal.start_date,
          endDate: goal.end_date,
          milestones: milestones || [],
        };
      }),
    );

    return goalsWithMilestones;
  },

  async getByType(type) {
    const all = await this.getAll();
    return all.filter((g) => g.type === type);
  },

  async add(goal) {
    const userId = getUserId();
    if (!userId) return null;

    const { data, error } = await supabaseClient
      .from("goals")
      .insert({
        user_id: userId,
        title: goal.title,
        type: goal.type,
        color: goal.color || "red",
        start_date: goal.startDate,
        end_date: goal.endDate,
      })
      .select()
      .single();

    if (error) {
      console.error("Goals add error:", error);
      return null;
    }
    return data?.id;
  },

  async update(id, changes) {
    const updateData = {};
    if (changes.title !== undefined) updateData.title = changes.title;
    if (changes.type !== undefined) updateData.type = changes.type;
    if (changes.color !== undefined) updateData.color = changes.color;
    if (changes.startDate !== undefined)
      updateData.start_date = changes.startDate;
    if (changes.endDate !== undefined) updateData.end_date = changes.endDate;

    const { error } = await supabaseClient
      .from("goals")
      .update(updateData)
      .eq("id", id);
    if (error) console.error("Goals update error:", error);
  },

  async delete(id) {
    // Milestones는 CASCADE로 자동 삭제됨
    const { error } = await supabaseClient.from("goals").delete().eq("id", id);
    if (error) console.error("Goals delete error:", error);
  },
};

// ==================== Milestones API ====================
const MilestonesDB = {
  async getByGoal(goalId) {
    const { data, error } = await supabaseClient
      .from("milestones")
      .select("*")
      .eq("goal_id", goalId);

    return data || [];
  },

  async add(milestone) {
    const { data, error } = await supabaseClient
      .from("milestones")
      .insert({
        goal_id: milestone.goalId,
        title: milestone.title,
        completed: milestone.completed || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Milestones add error:", error);
      return null;
    }
    return data;
  },

  async toggle(id) {
    const { data: milestone } = await supabaseClient
      .from("milestones")
      .select("completed")
      .eq("id", id)
      .single();

    if (milestone) {
      await supabaseClient
        .from("milestones")
        .update({ completed: !milestone.completed })
        .eq("id", id);
    }
  },

  async delete(id) {
    const { error } = await supabaseClient
      .from("milestones")
      .delete()
      .eq("id", id);
    if (error) console.error("Milestones delete error:", error);
  },
};

// ==================== Notes API ====================
const NotesDB = {
  async getAll() {
    const userId = getUserId();
    if (!userId) return [];

    const { data, error } = await supabaseClient
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Notes getAll error:", error);
      return [];
    }

    return (data || []).map((n) => ({
      ...n,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));
  },

  async search(query) {
    const userId = getUserId();
    if (!userId) return [];

    const q = query.toLowerCase();
    const { data, error } = await supabaseClient
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`);

    return (data || []).map((n) => ({
      ...n,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));
  },

  async add(note) {
    const userId = getUserId();
    if (!userId) return null;

    const { data, error } = await supabaseClient
      .from("notes")
      .insert({
        user_id: userId,
        title: note.title || "",
        content: note.content || "",
        color: note.color || "yellow",
        pinned: note.pinned || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Notes add error:", error);
      return null;
    }
    return data;
  },

  async update(id, changes) {
    const updateData = {};
    if (changes.title !== undefined) updateData.title = changes.title;
    if (changes.content !== undefined) updateData.content = changes.content;
    if (changes.color !== undefined) updateData.color = changes.color;
    if (changes.pinned !== undefined) updateData.pinned = changes.pinned;

    const { error } = await supabaseClient
      .from("notes")
      .update(updateData)
      .eq("id", id);
    if (error) console.error("Notes update error:", error);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("notes").delete().eq("id", id);
    if (error) console.error("Notes delete error:", error);
  },

  async togglePin(id) {
    const { data: note } = await supabaseClient
      .from("notes")
      .select("pinned")
      .eq("id", id)
      .single();

    if (note) {
      await supabaseClient
        .from("notes")
        .update({ pinned: !note.pinned })
        .eq("id", id);
    }
  },
};

// ==================== DB Object (for settings.js compatibility) ====================
const db = {
  todos: {
    count: async () => {
      const data = await TodosDB.getAll();
      return data.length;
    },
    toArray: () => TodosDB.getAll(),
    clear: async () => {
      const userId = getUserId();
      if (userId)
        await supabaseClient.from("todos").delete().eq("user_id", userId);
    },
  },
  events: {
    count: async () => {
      const data = await EventsDB.getAll();
      return data.length;
    },
    toArray: () => EventsDB.getAll(),
    clear: async () => {
      const userId = getUserId();
      if (userId)
        await supabaseClient.from("events").delete().eq("user_id", userId);
    },
    get: async (id) => {
      const { data } = await supabaseClient
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      return data
        ? { ...data, endDate: data.end_date, allDay: data.all_day }
        : null;
    },
  },
  goals: {
    count: async () => {
      const data = await GoalsDB.getAll();
      return data.length;
    },
    toArray: () => GoalsDB.getAll(),
    clear: async () => {
      const userId = getUserId();
      if (userId)
        await supabaseClient.from("goals").delete().eq("user_id", userId);
    },
  },
  milestones: {
    count: async () => {
      const userId = getUserId();
      if (!userId) return 0;
      const goals = await GoalsDB.getAll();
      return goals.reduce((sum, g) => sum + (g.milestones?.length || 0), 0);
    },
    toArray: async () => {
      const goals = await GoalsDB.getAll();
      return goals.flatMap((g) => g.milestones || []);
    },
    clear: async () => {
      // Goals 삭제 시 CASCADE로 처리됨
    },
  },
  notes: {
    count: async () => {
      const data = await NotesDB.getAll();
      return data.length;
    },
    toArray: () => NotesDB.getAll(),
    clear: async () => {
      const userId = getUserId();
      if (userId)
        await supabaseClient.from("notes").delete().eq("user_id", userId);
    },
  },
  settings: {
    toArray: () => SettingsDB.getAll(),
    clear: () => SettingsDB.clear(),
    get: (key) => SettingsDB.get(key),
    put: (setting) => SettingsDB.set(setting.key, setting.value),
  },
  todos_obj: {
    get: async (id) => {
      const { data } = await supabaseClient
        .from("todos")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
  },
};
