// ==================== Supabase Database API ====================

// ==================== Cache Helper ====================
const CACHE_PREFIX = "planner_cache_";
const CACHE_DURATION = 5 * 60 * 1000; // 5분

const CacheHelper = {
  get(key) {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;

      return { data, isExpired };
    } catch (e) {
      return null;
    }
  },

  set(key, data) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch (e) {
      console.warn("Cache save failed:", e);
    }
  },

  clear(key) {
    localStorage.removeItem(CACHE_PREFIX + key);
  },

  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },
};

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
  _cacheKey: "todos",

  async getAll(useCache = true) {
    const userId = getUserId();
    if (!userId) return [];

    // 캐시 확인
    if (useCache) {
      const cached = CacheHelper.get(this._cacheKey);
      if (cached && !cached.isExpired) {
        return cached.data;
      }
    }

    const { data, error } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Todos getAll error:", error);
      // 에러 시 만료된 캐시라도 반환
      const cached = CacheHelper.get(this._cacheKey);
      return cached?.data || [];
    }

    const result = data || [];
    CacheHelper.set(this._cacheKey, result);
    return result;
  },

  async getByDate(date) {
    const all = await this.getAll();
    return all.filter((t) => t.date === date);
  },

  async getUndated() {
    const all = await this.getAll();
    return all.filter((t) => !t.date);
  },

  async getTodayAndUndated() {
    const todayKey = formatDateKey(new Date());
    const all = await this.getAll();
    return all.filter((t) => t.date === todayKey || !t.date);
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

    CacheHelper.clear(this._cacheKey);
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
    CacheHelper.clear(this._cacheKey);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("todos").delete().eq("id", id);
    if (error) console.error("Todos delete error:", error);
    CacheHelper.clear(this._cacheKey);
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

    CacheHelper.clear(this._cacheKey);
  },
};

// ==================== Events API ====================
const EventsDB = {
  _cacheKey: "events",

  async getAll(useCache = true) {
    const userId = getUserId();
    if (!userId) return [];

    // 캐시 확인
    if (useCache) {
      const cached = CacheHelper.get(this._cacheKey);
      if (cached && !cached.isExpired) {
        return cached.data;
      }
    }

    const { data, error } = await supabaseClient
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Events getAll error:", error);
      const cached = CacheHelper.get(this._cacheKey);
      return cached?.data || [];
    }

    // 컬럼명 변환 (snake_case -> camelCase)
    const result = (data || []).map((e) => ({
      ...e,
      endDate: e.end_date,
      allDay: e.all_day,
    }));

    CacheHelper.set(this._cacheKey, result);
    return result;
  },

  async getByDate(date) {
    const all = await this.getAll();
    return all.filter((e) => e.date === date);
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

    CacheHelper.clear(this._cacheKey);
    return { ...data, endDate: data.end_date, allDay: data.all_day };
  },

  async update(id, changes) {
    const updateData = {};
    if (changes.date !== undefined) updateData.date = changes.date;
    if (changes.endDate !== undefined)
      updateData.end_date = changes.endDate || null;
    if (changes.text !== undefined) updateData.text = changes.text;
    if (changes.time !== undefined) updateData.time = changes.time || null;
    if (changes.color !== undefined) updateData.color = changes.color;
    if (changes.allDay !== undefined) updateData.all_day = changes.allDay;

    const { error } = await supabaseClient
      .from("events")
      .update(updateData)
      .eq("id", id);

    if (error) console.error("Events update error:", error);
    CacheHelper.clear(this._cacheKey);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("events").delete().eq("id", id);
    if (error) console.error("Events delete error:", error);
    CacheHelper.clear(this._cacheKey);
  },
};

// ==================== Goals API ====================
const GoalsDB = {
  _cacheKey: "goals",

  async getAll(useCache = true) {
    const userId = getUserId();
    if (!userId) return [];

    // 캐시 확인
    if (useCache) {
      const cached = CacheHelper.get(this._cacheKey);
      if (cached && !cached.isExpired) {
        return cached.data;
      }
    }

    const { data: goals, error } = await supabaseClient
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !goals) {
      const cached = CacheHelper.get(this._cacheKey);
      return cached?.data || [];
    }

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

    CacheHelper.set(this._cacheKey, goalsWithMilestones);
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

    CacheHelper.clear(this._cacheKey);
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
    CacheHelper.clear(this._cacheKey);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("goals").delete().eq("id", id);
    if (error) console.error("Goals delete error:", error);
    CacheHelper.clear(this._cacheKey);
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

    CacheHelper.clear(GoalsDB._cacheKey);
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

    CacheHelper.clear(GoalsDB._cacheKey);
  },

  async delete(id) {
    const { error } = await supabaseClient
      .from("milestones")
      .delete()
      .eq("id", id);

    if (error) console.error("Milestones delete error:", error);
    CacheHelper.clear(GoalsDB._cacheKey);
  },
};

// ==================== Notes API ====================
const NotesDB = {
  _cacheKey: "notes",

  async getAll(useCache = true) {
    const userId = getUserId();
    if (!userId) return [];

    // 캐시 확인
    if (useCache) {
      const cached = CacheHelper.get(this._cacheKey);
      if (cached && !cached.isExpired) {
        return cached.data;
      }
    }

    const { data, error } = await supabaseClient
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Notes getAll error:", error);
      const cached = CacheHelper.get(this._cacheKey);
      return cached?.data || [];
    }

    const result = (data || []).map((n) => ({
      ...n,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    CacheHelper.set(this._cacheKey, result);
    return result;
  },

  async search(query) {
    const all = await this.getAll();
    const q = query.toLowerCase();
    return all.filter(
      (n) =>
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q),
    );
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

    CacheHelper.clear(this._cacheKey);
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
    CacheHelper.clear(this._cacheKey);
  },

  async delete(id) {
    const { error } = await supabaseClient.from("notes").delete().eq("id", id);
    if (error) console.error("Notes delete error:", error);
    CacheHelper.clear(this._cacheKey);
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

    CacheHelper.clear(this._cacheKey);
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
      CacheHelper.clear(TodosDB._cacheKey);
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
      CacheHelper.clear(EventsDB._cacheKey);
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
      CacheHelper.clear(GoalsDB._cacheKey);
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
      CacheHelper.clear(NotesDB._cacheKey);
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
