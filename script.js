const menuBtn = document.getElementById("menuBtn");
const siteSidebar = document.getElementById("siteSidebar");
const sidebarClose = document.getElementById("sidebarClose");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const AUTH_KEYS = {
  users: "ip_users",
  session: "ip_session",
};
const REACH_MESSAGES_KEY = "ip_reach_messages";
const NOTIFICATIONS_KEY = "ip_notifications";

function closeSidebar() {
  if (!siteSidebar || !menuBtn || !sidebarBackdrop) return;
  siteSidebar.classList.remove("open");
  siteSidebar.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
  sidebarBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function openSidebar() {
  if (!siteSidebar || !menuBtn || !sidebarBackdrop) return;
  siteSidebar.classList.add("open");
  siteSidebar.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true");
  sidebarBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

if (menuBtn && siteSidebar && sidebarBackdrop) {
  menuBtn.addEventListener("click", () => {
    if (siteSidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  siteSidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });
}

if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

function readAuthJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function getLoggedInUser() {
  const session = readAuthJson(AUTH_KEYS.session, null);
  if (!session?.userId) return null;
  const users = readAuthJson(AUTH_KEYS.users, []);
  return users.find((user) => user.id === session.userId) || null;
}

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return `${first}${second || ""}`.toUpperCase() || "U";
}

function getProfileImage(user) {
  if (user?.profilePhoto) return user.profilePhoto;
  const initials = getInitials(user?.name);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='#5b7eb0'/><stop offset='100%' stop-color='#1f3f6e'/></linearGradient></defs><rect width='120' height='120' fill='url(#g)'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Barlow, sans-serif' font-size='48' fill='white' font-weight='700'>${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function removeAuthLinks(container) {
  if (!container) return;
  container.querySelectorAll('a[href="signup.html"], a[href="login.html"]').forEach((link) => {
    const item = link.closest("li") || link;
    item.remove();
  });
}

function addHeaderProfileNav(user) {
  const navList = document.getElementById("navLinks");
  if (!navList || !user) return;
  removeAuthLinks(navList);
  const profileImage = getProfileImage(user);

  const profileItem = document.createElement("li");
  profileItem.className = "profile-menu-item";
  profileItem.innerHTML = `
    <div class="profile-menu-wrap">
      <button type="button" class="profile-chip profile-toggle" id="profileToggleBtn" aria-expanded="false">
        <img class="profile-avatar profile-avatar-sm" src="${profileImage}" alt="Profile photo">
        <span class="profile-chip-name">${user.name || "Profile"}</span>
      </button>
      <div class="profile-dropdown" id="profileDropdown" hidden>
        <a href="#" id="indexLogoutLink">Log Out</a>
      </div>
    </div>
  `;

  navList.appendChild(profileItem);
}

function addSidebarProfileNav(user) {
  const sidebarNav = document.querySelector(".sidebar-nav");
  if (!sidebarNav || !user) return;
  removeAuthLinks(sidebarNav);

  const profileBox = document.createElement("div");
  profileBox.className = "profile-side-box";
  profileBox.innerHTML = `
    <a class="profile-chip" href="${user.role === "admin" ? "admin.html" : "dashboard.html"}">
      <img class="profile-avatar profile-avatar-sm" src="${getProfileImage(user)}" alt="Profile photo">
      <span class="profile-chip-name">${user.name || "Profile"}</span>
    </a>
    <a href="#" id="indexSidebarLogoutLink">Log Out</a>
  `;

  sidebarNav.appendChild(profileBox);
}

function bindProfileMenu() {
  const toggle = document.getElementById("profileToggleBtn");
  const dropdown = document.getElementById("profileDropdown");
  if (!toggle || !dropdown) return;

  toggle.addEventListener("click", () => {
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("click", (event) => {
    if (toggle.contains(event.target) || dropdown.contains(event.target)) return;
    dropdown.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
}

function bindIndexLogout() {
  const logoutLinks = document.querySelectorAll("#indexLogoutLink, #indexSidebarLogoutLink");
  if (logoutLinks.length === 0) return;
  logoutLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem(AUTH_KEYS.session);
      window.location.href = "index.html";
    });
  });
}

function renderIndexAuthState() {
  const user = getLoggedInUser();
  if (!user) return;
  addHeaderProfileNav(user);
  addSidebarProfileNav(user);
  bindProfileMenu();
  bindIndexLogout();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function setFormMessage(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.className = isError ? "form-msg error" : "form-msg";
}

function addReachMessageToStorage(payload) {
  const allMessages = readJson(REACH_MESSAGES_KEY, []);
  allMessages.push({
    id: createId(),
    ...payload,
    read: false,
    createdAt: new Date().toISOString(),
  });
  writeJson(REACH_MESSAGES_KEY, allMessages);
  return allMessages[allMessages.length - 1];
}

function notifyAdminsForReachMessage(reachMessage) {
  const users = readJson(AUTH_KEYS.users, []);
  const adminUsers = users.filter((entry) => entry.role === "admin");
  if (adminUsers.length === 0) return;

  const notifications = readJson(NOTIFICATIONS_KEY, []);
  const preview = reachMessage.message.length > 60
    ? `${reachMessage.message.slice(0, 60)}...`
    : reachMessage.message;
  adminUsers.forEach((adminUser) => {
    notifications.push({
      id: createId(),
      userId: adminUser.id,
      message: `New Reach Us message from ${reachMessage.name} (${reachMessage.phone}): ${preview}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: "reach_us_message",
      reachMessageId: reachMessage.id,
    });
  });
  writeJson(NOTIFICATIONS_KEY, notifications);
}

function bindReachUsForm() {
  const form = document.getElementById("reachUsForm");
  const msg = document.getElementById("reachUsMsg");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const phone = form.phone.value.trim();
    const projectLocation = form.projectLocation.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !phone || !projectLocation || !message) {
      setFormMessage(msg, "All fields are required.", true);
      return;
    }

    const user = getLoggedInUser();
    const storedMessage = addReachMessageToStorage({
      userId: user?.id || null,
      name,
      email,
      phone,
      projectLocation,
      message,
    });
    notifyAdminsForReachMessage(storedMessage);

    form.reset();
    setFormMessage(msg, "Message sent successfully. Admin will contact you soon.");
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    const target = document.querySelector(targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

const reveals = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  },
  { threshold: 0.2 }
);

reveals.forEach((card) => revealObserver.observe(card));

const testimonials = document.querySelectorAll(".testimonial");
let activeIndex = 0;

if (testimonials.length > 0) {
  setInterval(() => {
    testimonials[activeIndex].classList.remove("active");
    activeIndex = (activeIndex + 1) % testimonials.length;
    testimonials[activeIndex].classList.add("active");
  }, 3500);
}

function bindAppSliderPauseOnScroll() {
  const appTrack = document.querySelector(".app-track");
  if (!appTrack) return;

  let resumeTimer = null;
  const pauseSlider = () => {
    appTrack.classList.add("is-paused");
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      appTrack.classList.remove("is-paused");
    }, 180);
  };

  window.addEventListener("scroll", pauseSlider, { passive: true });
}

function bindGetStartedGuard() {
  const getStartedBtn = document.getElementById("portalGetStartedBtn");
  const toast = document.getElementById("portalToast");
  if (!getStartedBtn || !toast) return;

  let hideTimer = null;
  const showToast = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.hidden = true;
      }, 220);
    }, 2400);
  };

  getStartedBtn.addEventListener("click", (event) => {
    const user = getLoggedInUser();
    if (!user) return;
    event.preventDefault();
    showToast(`Already login as ${user.name || "User"}. You can continue from dashboard.`);
  });
}

renderIndexAuthState();
bindReachUsForm();
bindAppSliderPauseOnScroll();
bindGetStartedGuard();
