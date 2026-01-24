// ==================== Auth Module ====================
let currentUser = null;

// ==================== Initialize Auth ====================
async function initAuth() {
  // Check existing session
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    hideLoadingScreen();
    hideAuthScreen();
    return true;
  }

  hideLoadingScreen();
  showAuthScreen();
  return false;
}

// ==================== Loading Screen ====================
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }
}

// ==================== Auth State Change Listener ====================
function setupAuthListener() {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth event:", event);

    if (event === "SIGNED_IN" && session) {
      currentUser = session.user;
      await loadUserProfile();
      hideAuthScreen();
      await initializeApp();
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      showAuthScreen();
    }
  });
}

// ==================== Load User Profile ====================
async function loadUserProfile() {
  if (!currentUser) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (data) {
    currentUser.profile = data;
  }

  return data;
}

// ==================== Get Current User ====================
function getCurrentUser() {
  return currentUser;
}

// ==================== Sign Up ====================
async function signUp(email, password, displayName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
      },
    },
  });

  if (error) throw error;
  return data;
}

// ==================== Sign In ====================
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ==================== Sign Out ====================
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;

  currentUser = null;
  showAuthScreen();
}

// ==================== Reset Password ====================
async function resetPassword(email) {
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin,
    },
  );

  if (error) throw error;
  return data;
}

// ==================== UI Functions ====================
function showAuthScreen() {
  const authScreen = document.getElementById("authScreen");
  if (authScreen) {
    authScreen.classList.remove("hidden");
  }

  const app = document.querySelector(".app");
  if (app) {
    app.style.display = "none";
  }
}

function hideAuthScreen() {
  const authScreen = document.getElementById("authScreen");
  if (authScreen) {
    authScreen.classList.add("hidden");
  }

  const app = document.querySelector(".app");
  if (app) {
    app.style.display = "block";
  }

  updateUserMenu();
}

function updateUserMenu() {
  const userMenu = document.getElementById("userMenu");
  if (!userMenu || !currentUser) return;

  const displayName =
    currentUser.profile?.display_name ||
    currentUser.user_metadata?.full_name ||
    currentUser.email?.split("@")[0] ||
    "User";

  const initial = displayName.charAt(0).toUpperCase();

  userMenu.innerHTML = `
    <div class="user-info" id="userInfo">
      <div class="user-avatar">${initial}</div>
      <span class="user-name">${displayName}</span>
    </div>
    <button class="logout-btn" id="logoutBtn">로그아웃</button>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

function showAuthMessage(type, message) {
  const msgEl = document.getElementById("authMessage");
  if (!msgEl) return;

  msgEl.className = `auth-message ${type} show`;
  msgEl.textContent = message;

  // Auto hide after 5 seconds
  setTimeout(() => {
    msgEl.classList.remove("show");
  }, 5000);
}

function setAuthLoading(isLoading) {
  const btns = document.querySelectorAll(".auth-btn");
  btns.forEach((btn) => {
    btn.disabled = isLoading;
    btn.classList.toggle("loading", isLoading);
  });
}

// ==================== Bind Auth UI Events ====================
function bindAuthEvents() {
  // Tab switching
  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const resetForm = document.getElementById("resetForm");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.tab;
      if (target === "login") {
        loginForm.classList.add("active");
        signupForm.classList.remove("active");
        resetForm.classList.remove("active");
        document.querySelector(".auth-tabs").style.display = "flex";
      } else if (target === "signup") {
        loginForm.classList.remove("active");
        signupForm.classList.add("active");
        resetForm.classList.remove("active");
        document.querySelector(".auth-tabs").style.display = "flex";
      }

      // Clear messages
      const msgEl = document.getElementById("authMessage");
      if (msgEl) msgEl.classList.remove("show");
    });
  });

  // Login form submit
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        showAuthMessage("error", "이메일과 비밀번호를 입력하세요.");
        return;
      }

      setAuthLoading(true);

      try {
        await signIn(email, password);
        // Auth state change listener will handle the rest
      } catch (err) {
        console.error("Login error:", err);
        let message = "로그인에 실패했습니다.";
        if (err.message.includes("Invalid login")) {
          message = "이메일 또는 비밀번호가 올바르지 않습니다.";
        }
        showAuthMessage("error", message);
      } finally {
        setAuthLoading(false);
      }
    });
  }

  // Signup form submit
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirmPassword = document.getElementById("signupConfirm").value;

      if (!name || !email || !password || !confirmPassword) {
        showAuthMessage("error", "모든 필드를 입력하세요.");
        return;
      }

      if (password.length < 6) {
        showAuthMessage("error", "비밀번호는 6자 이상이어야 합니다.");
        return;
      }

      if (password !== confirmPassword) {
        showAuthMessage("error", "비밀번호가 일치하지 않습니다.");
        return;
      }

      setAuthLoading(true);

      try {
        await signUp(email, password, name);
        showAuthMessage(
          "success",
          "회원가입 완료! 이메일을 확인하여 계정을 활성화하세요.",
        );

        // Clear form
        signupForm.reset();

        // Switch to login tab
        setTimeout(() => {
          document.querySelector('.auth-tab[data-tab="login"]').click();
        }, 2000);
      } catch (err) {
        console.error("Signup error:", err);
        let message = "회원가입에 실패했습니다.";
        if (err.message.includes("already registered")) {
          message = "이미 가입된 이메일입니다.";
        }
        showAuthMessage("error", message);
      } finally {
        setAuthLoading(false);
      }
    });
  }

  // Reset password form
  const resetFormEl = document.getElementById("resetFormEl");
  if (resetFormEl) {
    resetFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("resetEmail").value.trim();

      if (!email) {
        showAuthMessage("error", "이메일을 입력하세요.");
        return;
      }

      setAuthLoading(true);

      try {
        await resetPassword(email);
        showAuthMessage(
          "success",
          "비밀번호 재설정 링크를 이메일로 보냈습니다.",
        );
      } catch (err) {
        console.error("Reset error:", err);
        showAuthMessage("error", "비밀번호 재설정에 실패했습니다.");
      } finally {
        setAuthLoading(false);
      }
    });
  }

  // Forgot password link
  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", () => {
      document.querySelector(".auth-tabs").style.display = "none";
      loginForm.classList.remove("active");
      signupForm.classList.remove("active");
      resetForm.classList.add("active");
    });
  }

  // Back to login link
  const backLink = document.getElementById("backToLogin");
  if (backLink) {
    backLink.addEventListener("click", () => {
      document.querySelector(".auth-tabs").style.display = "flex";
      document.querySelector('.auth-tab[data-tab="login"]').click();
    });
  }

  // Password visibility toggle
  document.querySelectorAll(".auth-input-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = toggle.parentElement.querySelector("input");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggle.textContent = isPassword ? "🙈" : "👁";
    });
  });
}

// ==================== Initialize Auth UI on DOM Load ====================
document.addEventListener("DOMContentLoaded", () => {
  bindAuthEvents();
  setupAuthListener();
});
