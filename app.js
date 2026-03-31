const STORAGE_KEYS = {
  users: "ip_users",
  session: "ip_session",
  bookings: "ip_bookings",
  settings: "ip_settings",
  notifications: "ip_notifications",
  reachMessages: "ip_reach_messages",
};
const BOOKING_AMOUNT = 100;
const CANCELLATION_CHARGE = 20;
const PLACE_NAMES = [
  "Goregaon",
];

function buildDefaultPlaceSlots(defaultCount = 4) {
  return PLACE_NAMES.reduce((acc, placeName) => {
    acc[placeName] = defaultCount;
    return acc;
  }, {});
}

function buildDefaultPlaceRates(defaultAmount = BOOKING_AMOUNT) {
  return PLACE_NAMES.reduce((acc, placeName) => {
    acc[placeName] = defaultAmount;
    return acc;
  }, {});
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

function initSystem() {
  const users = readJson(STORAGE_KEYS.users, []);
  const settings = readJson(STORAGE_KEYS.settings, null);
  const bookings = readJson(STORAGE_KEYS.bookings, null);
  const notifications = readJson(STORAGE_KEYS.notifications, null);
  const reachMessages = readJson(STORAGE_KEYS.reachMessages, null);

  if (!users.some((user) => user.role === "admin")) {
    users.push({
      id: createId(),
      name: "Admin",
      email: "admin@intellipark.com",
      password: "admin123",
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    writeJson(STORAGE_KEYS.users, users);
  } else if (users.length > 0) {
    writeJson(STORAGE_KEYS.users, users);
  }

  if (!settings) {
    writeJson(STORAGE_KEYS.settings, {
      placeSlots: buildDefaultPlaceSlots(4),
      placeRates: buildDefaultPlaceRates(BOOKING_AMOUNT),
    });
  } else {
    const fallbackCount = Number.isInteger(settings.totalSlots) ? settings.totalSlots : 4;
    const existingSlots =
      settings.placeSlots && typeof settings.placeSlots === "object" ? settings.placeSlots : {};
    const normalizedPlaceSlots = PLACE_NAMES.reduce((acc, placeName) => {
      const rawValue = existingSlots[placeName];
      const value = Number.isInteger(rawValue) && rawValue >= 0 ? rawValue : fallbackCount;
      acc[placeName] = value;
      return acc;
    }, {});
    const existingRates =
      settings.placeRates && typeof settings.placeRates === "object" ? settings.placeRates : {};
    const normalizedPlaceRates = PLACE_NAMES.reduce((acc, placeName) => {
      const rawValue = existingRates[placeName];
      const value = Number.isFinite(rawValue) && rawValue >= 0 ? Number(rawValue) : BOOKING_AMOUNT;
      acc[placeName] = value;
      return acc;
    }, {});
    writeJson(STORAGE_KEYS.settings, {
      ...settings,
      placeSlots: normalizedPlaceSlots,
      placeRates: normalizedPlaceRates,
    });
  }

  if (!bookings) {
    writeJson(STORAGE_KEYS.bookings, []);
  }

  if (!notifications) {
    writeJson(STORAGE_KEYS.notifications, []);
  }

  if (!reachMessages) {
    writeJson(STORAGE_KEYS.reachMessages, []);
  }
}

function getUsers() {
  return readJson(STORAGE_KEYS.users, []);
}

function getSettings() {
  const settings = readJson(STORAGE_KEYS.settings, {
    placeSlots: buildDefaultPlaceSlots(4),
    placeRates: buildDefaultPlaceRates(BOOKING_AMOUNT),
  });
  const baseSlots =
    settings.placeSlots && typeof settings.placeSlots === "object"
      ? settings.placeSlots
      : buildDefaultPlaceSlots(30);
  const baseRates =
    settings.placeRates && typeof settings.placeRates === "object"
      ? settings.placeRates
      : buildDefaultPlaceRates(BOOKING_AMOUNT);
  const placeSlots = PLACE_NAMES.reduce((acc, placeName) => {
    const rawValue = baseSlots[placeName];
    const value = Number.isInteger(rawValue) && rawValue >= 0 ? rawValue : 4;
    acc[placeName] = value;
    return acc;
  }, {});
  const placeRates = PLACE_NAMES.reduce((acc, placeName) => {
    const rawValue = baseRates[placeName];
    const value = Number.isFinite(rawValue) && rawValue >= 0 ? Number(rawValue) : BOOKING_AMOUNT;
    acc[placeName] = value;
    return acc;
  }, {});
  const totalSlots = Object.values(placeSlots).reduce((sum, value) => sum + value, 0);
  return { ...settings, placeSlots, placeRates, totalSlots };
}

function getBookings() {
  return readJson(STORAGE_KEYS.bookings, []);
}

function getPlaceBookingAmount(placeName) {
  const settings = getSettings();
  const amount = settings.placeRates?.[placeName];
  return Number.isFinite(amount) && amount >= 0 ? Number(amount) : BOOKING_AMOUNT;
}

function getBookingAmountForRecord(booking) {
  if (Number.isFinite(booking?.bookingAmount) && booking.bookingAmount >= 0) {
    return Number(booking.bookingAmount);
  }
  return getPlaceBookingAmount(booking?.placeName);
}

function getSession() {
  return readJson(STORAGE_KEYS.session, null);
}

function getNotifications() {
  return readJson(STORAGE_KEYS.notifications, []);
}

function getReachMessages() {
  return readJson(STORAGE_KEYS.reachMessages, []);
}

function getUnreadReachMessagesCount() {
  return getReachMessages().filter((entry) => !entry.read).length;
}

function markReachMessagesRead() {
  const messages = getReachMessages();
  let changed = false;
  const updated = messages.map((entry) => {
    if (entry.read) return entry;
    changed = true;
    return { ...entry, read: true, readAt: new Date().toISOString() };
  });
  if (changed) writeJson(STORAGE_KEYS.reachMessages, updated);
}

function addNotification(userId, message, meta = {}) {
  const notifications = getNotifications();
  notifications.push({
    id: createId(),
    userId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
    ...meta,
  });
  writeJson(STORAGE_KEYS.notifications, notifications);
}

function getUserNotifications(userId) {
  return getNotifications()
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function getUnreadNotificationCount(userId) {
  return getUserNotifications(userId).filter((entry) => !entry.read).length;
}

function addNotificationToAdmins(message, meta = {}) {
  const admins = getUsers().filter((entry) => entry.role === "admin");
  admins.forEach((adminUser) => addNotification(adminUser.id, message, meta));
}

function markUserNotificationsRead(userId) {
  const notifications = getNotifications();
  let changed = false;
  const updated = notifications.map((entry) => {
    if (entry.userId !== userId || entry.read) return entry;
    changed = true;
    return { ...entry, read: true, readAt: new Date().toISOString() };
  });
  if (changed) writeJson(STORAGE_KEYS.notifications, updated);
}

function getBookingNetRevenue(booking) {
  if (!booking) return 0;
  const paidAmount =
    booking.paymentMethod === "upi" && ["paid", "paid_by_admin"].includes(booking.paymentStatus)
      ? getBookingAmountForRecord(booking)
      : 0;
  const refundAmount =
    Number.isFinite(booking.refundAmount) && booking.refundAmount > 0 ? Number(booking.refundAmount) : 0;
  return paidAmount - refundAmount;
}

function getAllRevenueTransactions() {
  const bookings = getBookings();
  const transactions = [];

  bookings.forEach((booking) => {
    const paidAmount =
      booking.paymentMethod === "upi" && ["paid", "paid_by_admin"].includes(booking.paymentStatus)
        ? getBookingAmountForRecord(booking)
        : 0;
    if (paidAmount > 0 && booking.createdAt) {
      transactions.push({
        date: booking.createdAt.slice(0, 10),
        placeName: booking.placeName || "-",
        amount: paidAmount,
      });
    }

    const refundAmount =
      Number.isFinite(booking.refundAmount) && booking.refundAmount > 0 ? Number(booking.refundAmount) : 0;
    if (refundAmount > 0 && booking.cancelledAt) {
      transactions.push({
        date: booking.cancelledAt.slice(0, 10),
        placeName: booking.placeName || "-",
        amount: -refundAmount,
      });
    }
  });

  return transactions;
}

function setSession(userId) {
  writeJson(STORAGE_KEYS.session, { userId });
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return getUsers().find((user) => user.id === session.userId) || null;
}

function updateUserById(userId, updater) {
  const users = getUsers();
  const updatedUsers = users.map((entry) => {
    if (entry.id !== userId) return entry;
    return updater(entry);
  });
  writeJson(STORAGE_KEYS.users, updatedUsers);
  return updatedUsers.find((entry) => entry.id === userId) || null;
}

function rangesOverlap(fromA, toA, fromB, toB) {
  const startA = new Date(`${fromA}T00:00:00`);
  const endA = new Date(`${toA}T00:00:00`);
  const startB = new Date(`${fromB}T00:00:00`);
  const endB = new Date(`${toB}T00:00:00`);
  return startA <= endB && startB <= endA;
}

function isBookingOnDate(booking, dateString) {
  if (!booking.fromDate || !booking.toDate) return true;
  return rangesOverlap(booking.fromDate, booking.toDate, dateString, dateString);
}

function getBookedSlots(fromDate = null, toDate = null) {
  return getBookings()
    .filter((booking) => {
      if (booking.status !== "booked") return false;
      if (!fromDate || !toDate) return true;
      if (!booking.fromDate || !booking.toDate) return true;
      return rangesOverlap(booking.fromDate, booking.toDate, fromDate, toDate);
    })
    .map((booking) => booking.slotNumber);
}

function getActiveBookings(fromDate = null, toDate = null, placeName = null) {
  return getBookings().filter((booking) => {
    if (booking.status !== "booked") return false;
    if (placeName && booking.placeName !== placeName) return false;
    if (!fromDate || !toDate) return true;
    if (!booking.fromDate || !booking.toDate) return true;
    return rangesOverlap(booking.fromDate, booking.toDate, fromDate, toDate);
  });
}

function getAvailableSlotsCount(fromDate = null, toDate = null, placeName = null) {
  const settings = getSettings();
  if (placeName) {
    const placeCapacity = settings.placeSlots?.[placeName] ?? 0;
    const bookedCount = getActiveBookings(null, null, placeName).length;
    return Math.max(placeCapacity - bookedCount, 0);
  }

  const totalAvailable = PLACE_NAMES.reduce(
    (sum, currentPlace) => sum + getAvailableSlotsCount(null, null, currentPlace),
    0
  );
  return totalAvailable;
}

function findNextSlotNumber(fromDate = null, toDate = null, placeName = null) {
  if (!placeName) return null;
  const settings = getSettings();
  const placeCapacity = settings.placeSlots?.[placeName] ?? 0;
  const taken = new Set(
    getActiveBookings(null, null, placeName).map((booking) => booking.slotNumber)
  );
  for (let i = 1; i <= placeCapacity; i += 1) {
    if (!taken.has(i)) return i;
  }
  return null;
}

function setMessage(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.className = isError ? "form-msg error" : "form-msg";
}

function formatDate(rawDate) {
  if (!rawDate) return "-";
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleString();
}

function formatDateOnly(rawDate) {
  if (!rawDate) return "-";
  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleDateString();
}

function formatTimeOnly(rawTime) {
  if (!rawTime) return "-";
  const parsed = new Date(`1970-01-01T${rawTime}`);
  if (Number.isNaN(parsed.getTime())) return rawTime;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function getQrImageUrl(data, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
}

function createGateQrPayload(booking) {
  return JSON.stringify({
    type: "INTELLIPARK_GATE_ENTRY",
    bookingId: booking.id,
    slotNumber: booking.slotNumber,
    userId: booking.userId,
    vehicleNumber: booking.vehicleNumber,
    fromDate: booking.fromDate,
    fromTime: booking.fromTime,
    toDate: booking.toDate,
    toTime: booking.toTime,
    issuedAt: new Date().toISOString(),
  });
}

function renderLoginPage() {
  const form = document.getElementById("loginForm");
  const msg = document.getElementById("loginMsg");
  if (!form) return;

  const currentUser = getCurrentUser();
  if (currentUser?.role === "admin") {
    window.location.href = "admin.html";
    return;
  }
  if (currentUser?.role === "user") {
    window.location.href = "index.html";
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value.trim();
    const user = getUsers().find((u) => u.email === email && u.password === password);

    if (!user) {
      setMessage(msg, "Invalid email or password.", true);
      return;
    }

    setSession(user.id);
    if (user.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
  });
}

function renderSignupPage() {
  const form = document.getElementById("signupForm");
  const msg = document.getElementById("signupMsg");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    if (!name || !email || !password) {
      setMessage(msg, "All fields are required.", true);
      return;
    }
    if (password.length < 6) {
      setMessage(msg, "Password must be at least 6 characters.", true);
      return;
    }
    if (password !== confirmPassword) {
      setMessage(msg, "Passwords do not match.", true);
      return;
    }

    const users = getUsers();
    if (users.some((user) => user.email === email)) {
      setMessage(msg, "Email already registered. Please login.", true);
      return;
    }

    const newUser = {
      id: createId(),
      name,
      email,
      password,
      role: "user",
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeJson(STORAGE_KEYS.users, users);
    setSession(newUser.id);
    window.location.href = "index.html";
  });
}

function renderForgotPasswordPage() {
  const form = document.getElementById("forgotPasswordForm");
  const msg = document.getElementById("forgotPasswordMsg");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const newPassword = form.newPassword.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    if (!email || !newPassword || !confirmPassword) {
      setMessage(msg, "All fields are required.", true);
      return;
    }
    if (newPassword.length < 6) {
      setMessage(msg, "Password must be at least 6 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(msg, "Passwords do not match.", true);
      return;
    }

    const users = getUsers();
    const userExists = users.some((entry) => entry.email === email);
    if (!userExists) {
      setMessage(msg, "No account found with this email.", true);
      return;
    }

    const updatedUsers = users.map((entry) =>
      entry.email === email
        ? { ...entry, password: newPassword, updatedAt: new Date().toISOString() }
        : entry
    );
    writeJson(STORAGE_KEYS.users, updatedUsers);
    setMessage(msg, "Password reset successful. Redirecting to login...");
    form.reset();
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  });
}

function renderDashboardPage() {
  const bookingPanel = document.getElementById("bookingPanel");
  const bookingForm = document.getElementById("bookingForm");
  if (!bookingForm) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  const welcome = document.getElementById("welcomeUser");
  const availableEl = document.getElementById("availableSlots");
  const totalEl = document.getElementById("totalSlots");
  const myBookingsEl = document.getElementById("myBookings");
  const bookingAmountInfo = document.getElementById("bookingAmountInfo");
  const msg = document.getElementById("bookingMsg");
  const logoutBtn = document.getElementById("logoutBtn");
  const notificationsBtn = document.getElementById("notificationsBtn");
  const notificationsBadge = document.getElementById("notificationsBadge");
  const paymentPanel = document.getElementById("paymentPanel");
  const paymentInfo = document.getElementById("paymentInfo");
  const upiQrImage = document.getElementById("upiQrImage");
  const upiPaidBtn = document.getElementById("upiPaidBtn");
  const upiCancelBtn = document.getElementById("upiCancelBtn");
  const placeAvailabilityEl = document.getElementById("placeAvailability");
  const profilePhotoPreview = document.getElementById("profilePhotoPreview");
  const profileIdentity = document.getElementById("profileIdentity");
  const profilePhotoInput = document.getElementById("profilePhotoInput");
  const saveProfilePhotoBtn = document.getElementById("saveProfilePhotoBtn");
  const removeProfilePhotoBtn = document.getElementById("removeProfilePhotoBtn");
  const profileMsg = document.getElementById("profileMsg");
  let selectedProfilePhoto = null;
  let pendingUpiBooking = null;
  let activePlaceName = bookingForm.placeName.value.trim();
  const today = new Date().toISOString().slice(0, 10);
  const placeOptions = Array.from(bookingForm.placeName.options)
    .map((option) => option.value.trim())
    .filter(Boolean);

  bookingForm.fromDate.min = today;
  bookingForm.toDate.min = today;

  bookingForm.fromDate.addEventListener("change", () => {
    const selectedFrom = bookingForm.fromDate.value || today;
    bookingForm.toDate.min = selectedFrom;
    if (bookingForm.toDate.value && bookingForm.toDate.value < selectedFrom) {
      bookingForm.toDate.value = selectedFrom;
    }
    renderStats();
    renderPlaceAvailability();
  });
  bookingForm.toDate.addEventListener("change", () => {
    renderStats();
    renderPlaceAvailability();
  });
  bookingForm.fromTime.addEventListener("change", () => {
    if (
      bookingForm.fromDate.value &&
      bookingForm.toDate.value &&
      bookingForm.fromDate.value === bookingForm.toDate.value &&
      bookingForm.toTime.value &&
      bookingForm.toTime.value < bookingForm.fromTime.value
    ) {
      bookingForm.toTime.value = bookingForm.fromTime.value;
    }
  });
  bookingForm.placeName.addEventListener("change", () => {
    activePlaceName = bookingForm.placeName.value.trim();
    renderPlaceAvailability();
    renderBookingAmountInfo();
  });
  bookingForm.paymentMethod.addEventListener("change", renderBookingAmountInfo);

  function resetPendingPayment() {
    pendingUpiBooking = null;
    paymentPanel.classList.add("hidden");
    paymentInfo.textContent = "";
    upiQrImage.src = "";
  }

  function createBookingRecord(baseDetails, paymentStatus) {
    const booking = {
      id: createId(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      slotNumber: baseDetails.slotNumber,
      placeName: baseDetails.placeName,
      vehicleNumber: baseDetails.vehicleNumber,
      bookingAmount: baseDetails.bookingAmount,
      fromDate: baseDetails.fromDate,
      fromTime: baseDetails.fromTime,
      toDate: baseDetails.toDate,
      toTime: baseDetails.toTime,
      paymentMethod: baseDetails.paymentMethod,
      paymentStatus,
      status: "booked",
      createdAt: new Date().toISOString(),
    };

    if (baseDetails.paymentMethod === "upi" && paymentStatus === "paid") {
      booking.gateQrData = createGateQrPayload(booking);
      booking.paidAt = new Date().toISOString();
      booking.paymentTxnId = `UPI-${createId()}`;
    }
    return booking;
  }

  function renderStats() {
    const settings = getSettings();
    const available = getAvailableSlotsCount();
    if (welcome) welcome.textContent = `Welcome, ${user.name}`;
    if (availableEl) availableEl.textContent = String(available);
    if (totalEl) totalEl.textContent = String(settings.totalSlots);
  }

  function renderPlaceAvailability() {
    if (!placeAvailabilityEl) return;

    if (bookingForm.placeName.value && !activePlaceName) {
      activePlaceName = bookingForm.placeName.value.trim();
    }

    placeAvailabilityEl.innerHTML = placeOptions
      .map((placeName) => {
        const available = getAvailableSlotsCount(null, null, placeName);
        const isActive = activePlaceName === placeName;
        return `
          <article class="place-slot-card${isActive ? " active" : ""}" data-place="${placeName}">
            <h4>${placeName}</h4>
            <p>Available Slots: ${available}</p>
            ${isActive ? '<button type="button" class="btn btn-primary book-now-btn">Book Now</button>' : ""}
          </article>
        `;
      })
      .join("");

    placeAvailabilityEl.querySelectorAll(".place-slot-card").forEach((card) => {
      card.addEventListener("click", () => {
        const placeName = card.getAttribute("data-place");
        if (!placeName) return;
        activePlaceName = placeName;
        bookingForm.placeName.value = placeName;
        renderPlaceAvailability();
        renderBookingAmountInfo();
      });
    });

    placeAvailabilityEl.querySelectorAll(".book-now-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openBookingPanel();
        bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
        const vehicleInput = bookingForm.vehicleNumber;
        if (vehicleInput) vehicleInput.focus();
      });
    });
  }

  function openBookingPanel() {
    if (!bookingPanel) return;
    bookingPanel.classList.remove("hidden");
  }

  function renderBookingAmountInfo() {
    if (!bookingAmountInfo) return;
    const placeName = bookingForm.placeName.value.trim();
    if (!placeName) {
      bookingAmountInfo.textContent = "Select place to view booking amount.";
      bookingAmountInfo.className = "form-msg";
      return;
    }
    const amount = getPlaceBookingAmount(placeName);
    const paymentMethod = bookingForm.paymentMethod.value || "upi";
    const mode = paymentMethod === "cash" ? "Cash" : "UPI";
    bookingAmountInfo.textContent = `Booking Amount: Rs ${amount} (${mode})`;
    bookingAmountInfo.className = "form-msg";
  }

  function renderNotificationBadge() {
    if (!notificationsBadge) return;
    const unreadCount = getUserNotifications(user.id).filter((entry) => !entry.read).length;
    if (unreadCount > 0) {
      notificationsBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      notificationsBadge.classList.remove("hidden");
    } else {
      notificationsBadge.textContent = "0";
      notificationsBadge.classList.add("hidden");
    }
  }

  function renderProfile() {
    if (!profilePhotoPreview || !profileIdentity) return;
    profilePhotoPreview.src = getProfileImage(user);
    profileIdentity.textContent = `${user.name} (${user.email})`;
  }

  function renderMyBookings() {
    const myBookings = getBookings().filter(
      (booking) => booking.userId === user.id && booking.status === "booked"
    );
    if (myBookings.length === 0) {
      myBookingsEl.innerHTML = "<p>No active booking yet.</p>";
      return;
    }

    myBookingsEl.innerHTML = myBookings
      .map(
        (booking) => `
          <article class="list-card">
            <h4>Slot #${booking.slotNumber}</h4>
            <p>Place: ${booking.placeName || "-"}</p>
            <p>Vehicle: ${booking.vehicleNumber}</p>
            <p>Duration: ${formatDateOnly(booking.fromDate)} to ${formatDateOnly(booking.toDate)}</p>
            <p>Time: ${formatTimeOnly(booking.fromTime)} to ${formatTimeOnly(booking.toTime)}</p>
            <p>Payment: ${(booking.paymentMethod || "cash").toUpperCase()} (${booking.paymentStatus || "pending"})</p>
            <p>Booked At: ${formatDate(booking.createdAt)}</p>
            ${
              booking.gateQrData
                ? `<img class="qr-preview small" src="${getQrImageUrl(
                    booking.gateQrData,
                    130
                  )}" alt="Gate entry QR code">`
                : booking.paymentMethod === "upi"
                  ? "<p>Gate QR will be available after successful UPI payment.</p>"
                  : "<p>Cash booking selected. Entry verification will be done at gate.</p>"
            }
            <button type="button" class="btn btn-outline cancel-booking" data-booking-id="${booking.id}">
              Cancel Booking
            </button>
          </article>
        `
      )
      .join("");

    document.querySelectorAll(".cancel-booking").forEach((button) => {
      button.addEventListener("click", () => {
        const bookingId = button.getAttribute("data-booking-id");
        const bookings = getBookings();
        const targetBooking = bookings.find((booking) => booking.id === bookingId);
        if (!targetBooking) {
          setMessage(msg, "Booking not found.", true);
          return;
        }

        const paidAmount =
          targetBooking.paymentMethod === "upi" &&
          ["paid", "paid_by_admin"].includes(targetBooking.paymentStatus)
            ? getBookingAmountForRecord(targetBooking)
            : 0;
        const refundAmount = Math.max(paidAmount - CANCELLATION_CHARGE, 0);
        const cancellationDue = paidAmount === 0 ? CANCELLATION_CHARGE : 0;
        const confirmationText =
          refundAmount > 0
            ? `Cancellation charge is Rs ${CANCELLATION_CHARGE}. Refund amount will be Rs ${refundAmount}. Do you want to continue?`
            : `Cancellation charge is Rs ${CANCELLATION_CHARGE}. Do you want to continue?`;
        const shouldCancel = window.confirm(confirmationText);
        if (!shouldCancel) {
          setMessage(msg, "Cancellation aborted.");
          return;
        }

        const updated = bookings.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                status: "cancelled",
                cancellationCharge: CANCELLATION_CHARGE,
                cancellationDue,
                refundAmount,
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : booking
        );
        writeJson(STORAGE_KEYS.bookings, updated);
        if (refundAmount > 0) {
          addNotification(
            user.id,
            `Booking cancelled for Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"}. Rs ${CANCELLATION_CHARGE} charge applied. Rs ${refundAmount} refundable.`
          );
          addNotificationToAdmins(
            `${user.name} cancelled Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"}.`
          );
          setMessage(
            msg,
            `Booking cancelled. Rs ${CANCELLATION_CHARGE} charge applied, Rs ${refundAmount} refundable.`
          );
        } else {
          addNotification(
            user.id,
            `Booking cancelled for Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"}. Rs ${CANCELLATION_CHARGE} cancellation charge applied.`
          );
          addNotificationToAdmins(
            `${user.name} cancelled Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"}.`
          );
          setMessage(
            msg,
            `Booking cancelled. Rs ${CANCELLATION_CHARGE} cancellation charge applied.`
          );
        }
        renderStats();
        renderPlaceAvailability();
        renderMyBookings();
      });
    });
  }

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const vehicleNumber = bookingForm.vehicleNumber.value.trim().toUpperCase();
    const placeName = bookingForm.placeName.value.trim();
    const fromDate = bookingForm.fromDate.value;
    const fromTime = bookingForm.fromTime.value;
    const toDate = bookingForm.toDate.value;
    const toTime = bookingForm.toTime.value;
    const paymentMethod = bookingForm.paymentMethod.value;

    if (!vehicleNumber) {
      setMessage(msg, "Vehicle number is required.", true);
      return;
    }
    if (!placeName) {
      setMessage(msg, "Please select place name.", true);
      return;
    }
    if (!fromDate || !toDate) {
      setMessage(msg, "Please select booking dates.", true);
      return;
    }
    if (!fromTime || !toTime) {
      setMessage(msg, "Please select booking times.", true);
      return;
    }
    if (new Date(`${toDate}T00:00:00`) < new Date(`${fromDate}T00:00:00`)) {
      setMessage(msg, "To date cannot be earlier than From date.", true);
      return;
    }
    if (
      fromDate === toDate &&
      new Date(`1970-01-01T${toTime}`) < new Date(`1970-01-01T${fromTime}`)
    ) {
      setMessage(msg, "To time cannot be earlier than From time on same day.", true);
      return;
    }

    const nextSlot = findNextSlotNumber(fromDate, toDate, placeName);
    if (!nextSlot) {
      setMessage(msg, `No slots available in ${placeName} for selected dates.`, true);
      return;
    }
    const bookingAmount = getPlaceBookingAmount(placeName);

    const baseDetails = {
      slotNumber: nextSlot,
      placeName,
      vehicleNumber,
      bookingAmount,
      fromDate,
      fromTime,
      toDate,
      toTime,
      paymentMethod,
    };

    if (paymentMethod === "upi") {
      pendingUpiBooking = baseDetails;
      const upiId = "intellipark@upi";
      const upiPayload = `upi://pay?pa=${upiId}&pn=IntelliPark&am=${bookingAmount}&cu=INR&tn=Slot-${nextSlot}`;
      paymentInfo.textContent = `Pay Rs ${bookingAmount} for Slot #${nextSlot} (${formatDateOnly(
        fromDate
      )} ${formatTimeOnly(fromTime)} to ${formatDateOnly(toDate)} ${formatTimeOnly(toTime)}).`;
      upiQrImage.src = getQrImageUrl(upiPayload, 220);
      paymentPanel.classList.remove("hidden");
      setMessage(msg, "UPI QR scan karke payment complete karein.");
      return;
    }

    const bookings = getBookings();
    const booking = createBookingRecord(baseDetails, "pending_cash");
    bookings.push(booking);
    writeJson(STORAGE_KEYS.bookings, bookings);
    bookingForm.reset();
    activePlaceName = "";
    resetPendingPayment();
    addNotification(
      user.id,
      `Booking confirmed: Slot #${nextSlot} at ${placeName}. Vehicle: ${vehicleNumber}. Duration: ${formatDateOnly(
        fromDate
      )} ${formatTimeOnly(fromTime)} to ${formatDateOnly(toDate)} ${formatTimeOnly(
        toTime
      )}. Payment: CASH (pending at gate).`
    );
    addNotificationToAdmins(
      `${user.name} booked Slot #${nextSlot} at ${placeName}. Vehicle ${vehicleNumber}.`
    );
    setMessage(msg, `Slot #${nextSlot} booked. Cash payment gate par karein.`);
    renderStats();
    renderPlaceAvailability();
    renderBookingAmountInfo();
    renderMyBookings();
  });

  upiPaidBtn.addEventListener("click", () => {
    if (!pendingUpiBooking) {
      setMessage(msg, "Koi pending UPI payment nahi hai.", true);
      return;
    }

    const slotStillAvailable =
      findNextSlotNumber(
        pendingUpiBooking.fromDate,
        pendingUpiBooking.toDate,
        pendingUpiBooking.placeName
      ) === pendingUpiBooking.slotNumber;
    if (!slotStillAvailable) {
      resetPendingPayment();
      setMessage(msg, "Selected slot ab available nahi hai. Please book again.", true);
      renderStats();
      renderPlaceAvailability();
      return;
    }

    const bookings = getBookings();
    const booking = createBookingRecord(pendingUpiBooking, "paid");
    bookings.push(booking);
    writeJson(STORAGE_KEYS.bookings, bookings);
    bookingForm.reset();
    activePlaceName = "";
    resetPendingPayment();
    addNotification(
      user.id,
      `Booking confirmed: Slot #${booking.slotNumber} at ${booking.placeName}. Vehicle: ${
        booking.vehicleNumber
      }. Duration: ${formatDateOnly(booking.fromDate)} ${formatTimeOnly(
        booking.fromTime
      )} to ${formatDateOnly(booking.toDate)} ${formatTimeOnly(
        booking.toTime
      )}. Payment: UPI (paid).`
    );
    addNotificationToAdmins(
      `${user.name} booked Slot #${booking.slotNumber} at ${booking.placeName}. Vehicle ${booking.vehicleNumber} (UPI paid).`
    );
    setMessage(msg, `Payment successful. Slot #${booking.slotNumber} booked with gate QR.`);
    renderStats();
    renderPlaceAvailability();
    renderBookingAmountInfo();
    renderMyBookings();
  });

  upiCancelBtn.addEventListener("click", () => {
    resetPendingPayment();
    setMessage(msg, "UPI payment cancelled.", true);
  });

  if (profilePhotoInput && saveProfilePhotoBtn && removeProfilePhotoBtn) {
    profilePhotoInput.addEventListener("change", () => {
      const [file] = profilePhotoInput.files || [];
      if (!file) {
        selectedProfilePhoto = null;
        return;
      }
      if (!file.type.startsWith("image/")) {
        selectedProfilePhoto = null;
        profilePhotoInput.value = "";
        setMessage(profileMsg, "Please select an image file.", true);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        selectedProfilePhoto = null;
        profilePhotoInput.value = "";
        setMessage(profileMsg, "Image size must be 2MB or less.", true);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        selectedProfilePhoto = typeof reader.result === "string" ? reader.result : null;
        if (!selectedProfilePhoto) {
          setMessage(profileMsg, "Unable to read image file.", true);
          return;
        }
        profilePhotoPreview.src = selectedProfilePhoto;
        setMessage(profileMsg, "Photo selected. Click Save Photo.");
      };
      reader.onerror = () => {
        selectedProfilePhoto = null;
        setMessage(profileMsg, "Unable to read image file.", true);
      };
      reader.readAsDataURL(file);
    });

    saveProfilePhotoBtn.addEventListener("click", () => {
      if (!selectedProfilePhoto) {
        setMessage(profileMsg, "Please choose a photo first.", true);
        return;
      }
      const updatedUser = updateUserById(user.id, (entry) => ({
        ...entry,
        profilePhoto: selectedProfilePhoto,
        updatedAt: new Date().toISOString(),
      }));
      if (!updatedUser) {
        setMessage(profileMsg, "Unable to save profile photo.", true);
        return;
      }
      user.profilePhoto = updatedUser.profilePhoto;
      profilePhotoInput.value = "";
      selectedProfilePhoto = null;
      renderProfile();
      setMessage(profileMsg, "Profile photo updated.");
    });

    removeProfilePhotoBtn.addEventListener("click", () => {
      const updatedUser = updateUserById(user.id, (entry) => {
        const clone = { ...entry, updatedAt: new Date().toISOString() };
        delete clone.profilePhoto;
        return clone;
      });
      if (!updatedUser) {
        setMessage(profileMsg, "Unable to remove profile photo.", true);
        return;
      }
      delete user.profilePhoto;
      selectedProfilePhoto = null;
      profilePhotoInput.value = "";
      renderProfile();
      setMessage(profileMsg, "Profile photo removed.");
    });
  }

  logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "login.html";
  });

  if (notificationsBtn) {
    notificationsBtn.addEventListener("click", () => {
      markUserNotificationsRead(user.id);
    });
  }

  function renderDashboardLive() {
    renderStats();
    renderPlaceAvailability();
    renderNotificationBadge();
    renderMyBookings();
  }

  // Live sync: another tab/window booking/release reflects instantly in user dashboard.
  window.addEventListener("storage", (event) => {
    if (
      event.key === STORAGE_KEYS.bookings ||
      event.key === STORAGE_KEYS.settings ||
      event.key === STORAGE_KEYS.notifications
    ) {
      renderDashboardLive();
    }
  });

  // Live sync in same tab/session as well.
  setInterval(renderDashboardLive, 2000);

  renderStats();
  renderPlaceAvailability();
  renderProfile();
  renderNotificationBadge();
  renderBookingAmountInfo();
  renderMyBookings();
}

function renderAdminPage() {
  const placeStatsWrap = document.getElementById("adminPlaceStats");
  if (!placeStatsWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const summaryEl = document.getElementById("adminSummary");
  const placeSlotsForm = document.getElementById("placeSlotsForm");
  const placeSelect = document.getElementById("adminPlaceSelect");
  const placeSlotCountInput = document.getElementById("adminPlaceSlotCount");
  const placeRateInput = document.getElementById("adminPlaceRate");
  const adminMsg = document.getElementById("adminMsg");
  const adminBookingForm = document.getElementById("adminBookingForm");
  const adminBookingMsg = document.getElementById("adminBookingMsg");
  const adminUserEmail = document.getElementById("adminUserEmail");
  const adminBookingsWrap = document.getElementById("adminBookings");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const adminReachMessagesBtn = document.getElementById("adminReachMessagesBtn");
  const adminReachMessagesBadge = document.getElementById("adminReachMessagesBadge");
  const adminNotificationsBtn = document.getElementById("adminNotificationsBtn");
  const adminNotificationsBadge = document.getElementById("adminNotificationsBadge");

  const adminFromDate = document.getElementById("adminFromDate");
  const adminToDate = document.getElementById("adminToDate");
  const adminFromTime = document.getElementById("adminFromTime");
  const adminToTime = document.getElementById("adminToTime");
  const adminBookingPlace = document.getElementById("adminBookingPlace");
  const adminVehicleNumber = document.getElementById("adminVehicleNumber");
  const adminPaymentMethod = document.getElementById("adminPaymentMethod");

  const today = new Date().toISOString().slice(0, 10);
  if (adminFromDate) adminFromDate.min = today;
  if (adminToDate) adminToDate.min = today;

  if (adminFromDate && adminToDate) {
    adminFromDate.addEventListener("change", () => {
      const selectedFrom = adminFromDate.value || today;
      adminToDate.min = selectedFrom;
      if (adminToDate.value && adminToDate.value < selectedFrom) {
        adminToDate.value = selectedFrom;
      }
    });
  }

  if (adminFromTime && adminToTime && adminFromDate && adminToDate) {
    adminFromTime.addEventListener("change", () => {
      if (
        adminFromDate.value &&
        adminToDate.value &&
        adminFromDate.value === adminToDate.value &&
        adminToTime.value &&
        adminToTime.value < adminFromTime.value
      ) {
        adminToTime.value = adminFromTime.value;
      }
    });
  }

  function renderAdminNotificationBadge() {
    if (!adminNotificationsBadge) return;
    const unreadCount = getUnreadNotificationCount(user.id);
    if (unreadCount > 0) {
      adminNotificationsBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      adminNotificationsBadge.classList.remove("hidden");
    } else {
      adminNotificationsBadge.textContent = "0";
      adminNotificationsBadge.classList.add("hidden");
    }
  }

  function renderAdminReachMessagesBadge() {
    if (!adminReachMessagesBadge) return;
    const unreadCount = getUnreadReachMessagesCount();
    if (unreadCount > 0) {
      adminReachMessagesBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      adminReachMessagesBadge.classList.remove("hidden");
    } else {
      adminReachMessagesBadge.textContent = "0";
      adminReachMessagesBadge.classList.add("hidden");
    }
  }

  function renderPlaceSlotInput() {
    if (!placeSelect || !placeSlotCountInput || !placeRateInput) return;
    const settings = getSettings();
    const selectedPlace = placeSelect.value;
    const slotsValue = settings.placeSlots?.[selectedPlace] ?? 0;
    const rateValue = settings.placeRates?.[selectedPlace] ?? BOOKING_AMOUNT;
    placeSlotCountInput.value = String(slotsValue);
    placeRateInput.value = String(rateValue);
  }

  function renderAdminOverview() {
    const settings = getSettings();
    const activeBookings = getBookings().filter((entry) => entry.status === "booked");
    const totalSlots = settings.totalSlots;
    const bookedCount = activeBookings.length;
    const availableCount = Math.max(totalSlots - bookedCount, 0);

    if (summaryEl) {
      summaryEl.textContent = `Total Slots: ${totalSlots} | Booked: ${bookedCount} | Available: ${availableCount}`;
    }

    placeStatsWrap.innerHTML = PLACE_NAMES.map((placeName) => {
      const placeTotal = settings.placeSlots?.[placeName] ?? 0;
      const placeRate = settings.placeRates?.[placeName] ?? BOOKING_AMOUNT;
      const placeBooked = activeBookings.filter((entry) => entry.placeName === placeName).length;
      const placeAvailable = Math.max(placeTotal - placeBooked, 0);
      return `
        <article class="place-slot-card">
          <h4>${placeName}</h4>
          <p>Rate: Rs ${placeRate}</p>
          <p>Total: ${placeTotal}</p>
          <p>Booked: ${placeBooked}</p>
          <p>Available: ${placeAvailable}</p>
        </article>
      `;
    }).join("");

    renderAdminNotificationBadge();
    renderAdminReachMessagesBadge();
  }

  function renderAdminBookings() {
    const bookings = getBookings().filter((entry) => entry.status === "booked");
    if (bookings.length === 0) {
      adminBookingsWrap.innerHTML = "<p>No active booking records.</p>";
      return;
    }

    adminBookingsWrap.innerHTML = bookings
      .sort((a, b) => {
        if ((a.placeName || "") < (b.placeName || "")) return -1;
        if ((a.placeName || "") > (b.placeName || "")) return 1;
        return a.slotNumber - b.slotNumber;
      })
      .map(
        (booking) => `
          <article class="list-card">
            <h4>Slot #${booking.slotNumber} (${booking.placeName || "-"})</h4>
            <p>User: ${booking.userName} (${booking.userEmail})</p>
            <p>Vehicle: ${booking.vehicleNumber}</p>
            <p>Duration: ${formatDateOnly(booking.fromDate)} ${formatTimeOnly(
              booking.fromTime
            )} to ${formatDateOnly(booking.toDate)} ${formatTimeOnly(booking.toTime)}</p>
            <p>Payment: ${(booking.paymentMethod || "cash").toUpperCase()} (${booking.paymentStatus || "pending"})</p>
            <p>Booked At: ${formatDate(booking.createdAt)}</p>
            <button type="button" class="btn btn-outline admin-cancel-booking" data-booking-id="${booking.id}">
              Cancel Booking
            </button>
          </article>
        `
      )
      .join("");

    document.querySelectorAll(".admin-cancel-booking").forEach((button) => {
      button.addEventListener("click", () => {
        const bookingId = button.getAttribute("data-booking-id");
        const bookingsAll = getBookings();
        const targetBooking = bookingsAll.find((entry) => entry.id === bookingId);
        if (!targetBooking) {
          setMessage(adminMsg, "Booking not found.", true);
          return;
        }

        const shouldCancel = window.confirm(
          `Cancel Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"} for ${targetBooking.userName}?`
        );
        if (!shouldCancel) return;

        const updated = bookingsAll.map((entry) =>
          entry.id === bookingId
            ? {
                ...entry,
                status: "cancelled",
                cancelledBy: "admin",
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : entry
        );
        writeJson(STORAGE_KEYS.bookings, updated);

        if (targetBooking.userId) {
          addNotification(
            targetBooking.userId,
            `Admin cancelled your Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"} booking.`
          );
        }
        addNotification(
          user.id,
          `You cancelled Slot #${targetBooking.slotNumber} at ${targetBooking.placeName || "-"} for ${targetBooking.userName}.`
        );
        setMessage(adminMsg, "Booking cancelled successfully.");
        renderAdminOverview();
        renderAdminBookings();
      });
    });
  }

  if (placeSelect) {
    placeSelect.addEventListener("change", renderPlaceSlotInput);
  }

  if (placeSlotsForm) {
    placeSlotsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!placeSelect || !placeSlotCountInput || !placeRateInput) return;

      const selectedPlace = placeSelect.value;
      const newCount = Number.parseInt(placeSlotCountInput.value, 10);
      const newRate = Number.parseInt(placeRateInput.value, 10);
      if (!Number.isInteger(newCount) || newCount < 0) {
        setMessage(adminMsg, "Slots must be zero or positive number.", true);
        return;
      }
      if (!Number.isInteger(newRate) || newRate < 0) {
        setMessage(adminMsg, "Booking amount must be zero or positive number.", true);
        return;
      }

      const allBookings = getBookings();
      const activePlaceBookings = allBookings
        .filter((entry) => entry.status === "booked" && entry.placeName === selectedPlace)
        .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));
      const placeBooked = activePlaceBookings.length;
      const maxBookedSlotNumber = activePlaceBookings.reduce(
        (maxValue, entry) => Math.max(maxValue, entry.slotNumber || 0),
        0
      );
      if (newCount < placeBooked) {
        setMessage(adminMsg, `Cannot set below booked count for ${selectedPlace} (${placeBooked}).`, true);
        return;
      }

      // If current booked slots are sparse/high numbered, compact them so reduced capacity can still be applied safely.
      if (newCount < maxBookedSlotNumber && placeBooked > 0) {
        const remap = new Map();
        activePlaceBookings.forEach((entry, index) => {
          remap.set(entry.id, index + 1);
        });
        const normalizedBookings = allBookings.map((entry) => {
          if (!remap.has(entry.id)) return entry;
          return { ...entry, slotNumber: remap.get(entry.id), updatedAt: new Date().toISOString() };
        });
        writeJson(STORAGE_KEYS.bookings, normalizedBookings);
      }

      const settings = getSettings();
      const updatedPlaceSlots = { ...settings.placeSlots, [selectedPlace]: newCount };
      const updatedPlaceRates = { ...settings.placeRates, [selectedPlace]: newRate };
      writeJson(STORAGE_KEYS.settings, {
        ...settings,
        placeSlots: updatedPlaceSlots,
        placeRates: updatedPlaceRates,
      });
      addNotification(
        user.id,
        `Updated ${selectedPlace}: slots ${newCount}, booking amount Rs ${newRate}.`
      );
      setMessage(adminMsg, `${selectedPlace} updated: slots ${newCount}, amount Rs ${newRate}.`);
      renderAdminOverview();
    });
  }

  if (adminBookingForm) {
    adminBookingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (
        !adminUserEmail ||
        !adminVehicleNumber ||
        !adminBookingPlace ||
        !adminFromDate ||
        !adminFromTime ||
        !adminToDate ||
        !adminToTime ||
        !adminPaymentMethod
      ) {
        return;
      }

      const userEmail = adminUserEmail.value.trim().toLowerCase();
      const vehicleNumber = adminVehicleNumber.value.trim().toUpperCase();
      const placeName = adminBookingPlace.value.trim();
      const fromDate = adminFromDate.value;
      const fromTime = adminFromTime.value;
      const toDate = adminToDate.value;
      const toTime = adminToTime.value;
      const paymentMethod = adminPaymentMethod.value;
      const bookingAmount = getPlaceBookingAmount(placeName);

      if (!userEmail) {
        setMessage(adminBookingMsg, "User Gmail is required.", true);
        return;
      }
      const selectedUser = getUsers().find((entry) => entry.email === userEmail);
      if (!selectedUser) {
        setMessage(adminBookingMsg, "Please enter valid registered user Gmail.", true);
        return;
      }
      if (!vehicleNumber || !placeName || !fromDate || !fromTime || !toDate || !toTime) {
        setMessage(adminBookingMsg, "All booking fields are required.", true);
        return;
      }
      if (new Date(`${toDate}T00:00:00`) < new Date(`${fromDate}T00:00:00`)) {
        setMessage(adminBookingMsg, "To date cannot be earlier than From date.", true);
        return;
      }
      if (fromDate === toDate && new Date(`1970-01-01T${toTime}`) < new Date(`1970-01-01T${fromTime}`)) {
        setMessage(adminBookingMsg, "To time cannot be earlier than From time on same day.", true);
        return;
      }

      const nextSlot = findNextSlotNumber(fromDate, toDate, placeName);
      if (!nextSlot) {
        setMessage(adminBookingMsg, `No slots available in ${placeName}.`, true);
        return;
      }

      const booking = {
        id: createId(),
        userId: selectedUser.id,
        userName: selectedUser.name,
        userEmail: selectedUser.email,
        slotNumber: nextSlot,
        placeName,
        vehicleNumber,
        bookingAmount,
        fromDate,
        fromTime,
        toDate,
        toTime,
        paymentMethod,
        paymentStatus: paymentMethod === "upi" ? "paid_by_admin" : "pending_cash",
        status: "booked",
        createdBy: "admin",
        createdAt: new Date().toISOString(),
      };

      if (paymentMethod === "upi") {
        booking.gateQrData = createGateQrPayload(booking);
        booking.paidAt = new Date().toISOString();
        booking.paymentTxnId = `UPI-${createId()}`;
      }

      const bookings = getBookings();
      bookings.push(booking);
      writeJson(STORAGE_KEYS.bookings, bookings);

      addNotification(
        selectedUser.id,
        `Admin booked Slot #${booking.slotNumber} at ${booking.placeName} for you. Vehicle: ${booking.vehicleNumber}.`
      );
      addNotification(
        user.id,
        `You booked Slot #${booking.slotNumber} at ${booking.placeName} for ${selectedUser.name}.`
      );

      adminBookingForm.reset();
      if (adminFromDate) adminFromDate.min = today;
      if (adminToDate) adminToDate.min = today;
      setMessage(adminBookingMsg, `Booking created: Slot #${booking.slotNumber} at ${booking.placeName}.`);
      renderAdminOverview();
      renderAdminBookings();
    });
  }

  if (adminNotificationsBtn) {
    adminNotificationsBtn.addEventListener("click", () => {
      markUserNotificationsRead(user.id);
    });
  }

  if (adminReachMessagesBtn) {
    adminReachMessagesBtn.addEventListener("click", () => {
      markReachMessagesRead();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  function renderAdminLive() {
    renderAdminOverview();
    renderAdminBookings();
  }

  window.addEventListener("storage", (event) => {
    if (
      event.key === STORAGE_KEYS.bookings ||
      event.key === STORAGE_KEYS.settings ||
      event.key === STORAGE_KEYS.notifications ||
      event.key === STORAGE_KEYS.reachMessages ||
      event.key === STORAGE_KEYS.users
    ) {
      renderAdminLive();
    }
  });

  setInterval(renderAdminLive, 2000);
  renderAdminLive();
  renderPlaceSlotInput();
}

function renderNotificationsPage() {
  const notificationsWrap = document.getElementById("notificationsPageList");
  if (!notificationsWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  const meta = document.getElementById("notificationsMeta");
  const logoutBtn = document.getElementById("notificationsLogoutBtn");

  function renderPageNotifications() {
    const notifications = getUserNotifications(user.id);
    if (meta) meta.textContent = `Total notifications: ${notifications.length}`;

    if (notifications.length === 0) {
      notificationsWrap.innerHTML = "<p>No notifications yet.</p>";
      return;
    }

    notificationsWrap.innerHTML = notifications
      .map(
        (entry) => `
          <article class="list-card notification-item${entry.read ? "" : " unread"}">
            <p>${entry.message}</p>
            <p class="notification-time">${formatDate(entry.createdAt)}</p>
          </article>
        `
      )
      .join("");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.notifications) {
      renderPageNotifications();
    }
  });

  renderPageNotifications();
  markUserNotificationsRead(user.id);
  renderPageNotifications();
}

function renderAdminNotificationsPage() {
  const notificationsWrap = document.getElementById("adminNotificationsList");
  if (!notificationsWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const meta = document.getElementById("adminNotificationsMeta");
  const logoutBtn = document.getElementById("adminNotificationsLogoutBtn");

  function renderPageNotifications() {
    const notifications = getUserNotifications(user.id);
    if (meta) meta.textContent = `Total notifications: ${notifications.length}`;

    if (notifications.length === 0) {
      notificationsWrap.innerHTML = "<p>No notifications yet.</p>";
      return;
    }

    notificationsWrap.innerHTML = notifications
      .map(
        (entry) => `
          <article class="list-card notification-item${entry.read ? "" : " unread"}">
            <p>${entry.message}</p>
            <p class="notification-time">${formatDate(entry.createdAt)}</p>
          </article>
        `
      )
      .join("");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.notifications) {
      renderPageNotifications();
    }
  });

  renderPageNotifications();
  markUserNotificationsRead(user.id);
  renderPageNotifications();
}

function renderAdminReachMessagesPage() {
  const messagesWrap = document.getElementById("adminReachMessagesList");
  if (!messagesWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const meta = document.getElementById("adminReachMessagesMeta");
  const logoutBtn = document.getElementById("adminReachMessagesLogoutBtn");

  function renderReachMessages() {
    const messages = getReachMessages().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (meta) meta.textContent = `Total messages: ${messages.length}`;

    if (messages.length === 0) {
      messagesWrap.innerHTML = "<p>No reach out messages yet.</p>";
      return;
    }

    messagesWrap.innerHTML = messages
      .map(
        (entry) => `
          <article class="list-card notification-item${entry.read ? "" : " unread"}">
            <h4>${entry.name || "-"}</h4>
            <p>Email: ${entry.email || "-"}</p>
            <p>Phone: ${entry.phone || "-"}</p>
            <p>Project Location: ${entry.projectLocation || "-"}</p>
            <p>Message: ${entry.message || "-"}</p>
            <p class="notification-time">${formatDate(entry.createdAt)}</p>
          </article>
        `
      )
      .join("");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.reachMessages) {
      renderReachMessages();
    }
  });

  renderReachMessages();
  markReachMessagesRead();
  renderReachMessages();
}

function renderAdminRevenuePage() {
  const kpiWrap = document.getElementById("adminRevenueKpis");
  if (!kpiWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const byPlaceWrap = document.getElementById("adminRevenueByPlace");
  const byDayWrap = document.getElementById("adminRevenueByDay");
  const visualWrap = document.getElementById("adminRevenueVisual");
  const logoutBtn = document.getElementById("adminRevenueLogoutBtn");

  function renderRevenue() {
    const bookings = getBookings();
    const transactions = getAllRevenueTransactions();
    const totalRevenue = transactions.reduce((sum, entry) => sum + entry.amount, 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const revenueToday = transactions
      .filter((entry) => entry.date === todayStr)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const paidBookings = bookings.filter(
      (entry) => entry.paymentMethod === "upi" && ["paid", "paid_by_admin"].includes(entry.paymentStatus)
    );
    const paidBookingsCount = paidBookings.length;

    kpiWrap.innerHTML = `
      <article class="kpi-card">
        <p>Total Revenue</p>
        <h3>Rs ${Math.round(totalRevenue)}</h3>
      </article>
      <article class="kpi-card">
        <p>Revenue (Today)</p>
        <h3>Rs ${Math.round(revenueToday)}</h3>
      </article>
      <article class="kpi-card">
        <p>Paid Bookings</p>
        <h3>${paidBookingsCount}</h3>
      </article>
    `;

    if (visualWrap) {
      const monthBuckets = [];
      for (let i = 3; i >= 0; i -= 1) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const targetYear = d.getFullYear();
        const targetMonth = d.getMonth();

        let upiRevenue = 0;
        let cashRevenue = 0;

        bookings.forEach((booking) => {
          const created = booking.createdAt ? new Date(booking.createdAt) : null;
          if (
            created &&
            !Number.isNaN(created.getTime()) &&
            created.getFullYear() === targetYear &&
            created.getMonth() === targetMonth
          ) {
            const amount = getBookingAmountForRecord(booking);
            if (booking.paymentMethod === "upi" && ["paid", "paid_by_admin"].includes(booking.paymentStatus)) {
              upiRevenue += amount;
            }
            if (booking.paymentMethod === "cash" && booking.status === "booked") {
              cashRevenue += amount;
            }
          }

          const refundAmount =
            Number.isFinite(booking.refundAmount) && booking.refundAmount > 0
              ? Number(booking.refundAmount)
              : 0;
          if (refundAmount > 0 && booking.cancelledAt) {
            const cancelled = new Date(booking.cancelledAt);
            if (
              !Number.isNaN(cancelled.getTime()) &&
              cancelled.getFullYear() === targetYear &&
              cancelled.getMonth() === targetMonth
            ) {
              upiRevenue -= refundAmount;
            }
          }
        });

        monthBuckets.push({
          label: d.toLocaleDateString([], { month: "short" }),
          upi: Math.round(upiRevenue),
          cash: Math.round(cashRevenue),
          total: Math.round(upiRevenue + cashRevenue),
        });
      }

      const maxSeriesValue = Math.max(
        ...monthBuckets.map((entry) => Math.max(entry.upi, entry.cash, entry.total)),
        1
      );
      const chartHeight = 220;
      const yPad = 18;
      const usableHeight = chartHeight - yPad * 2;
      const xGap = 124;
      const xStart = 48;
      const chartWidth = xStart * 2 + xGap * (monthBuckets.length - 1);
      const linePoints = monthBuckets
        .map((entry, index) => {
          const x = xStart + index * xGap;
          const y = yPad + (1 - entry.total / maxSeriesValue) * usableHeight;
          return `${x},${y.toFixed(1)}`;
        })
        .join(" ");

      const upiTotal = monthBuckets.reduce((sum, entry) => sum + Math.max(entry.upi, 0), 0);
      const grossTotal = monthBuckets.reduce((sum, entry) => sum + Math.max(entry.total, 0), 0);
      const upiPercent = grossTotal > 0 ? Math.round((upiTotal / grossTotal) * 100) : 0;
      const ringPercent = Math.min(Math.max(upiPercent, 0), 100);

      visualWrap.innerHTML = `
        <div class="revenue-mix">
          <div class="mix-left">
            <div class="mix-legend">
              <span><i class="legend-swatch swatch-primary"></i> UPI Revenue</span>
              <span><i class="legend-swatch swatch-secondary"></i> Cash Revenue</span>
              <span><i class="legend-swatch swatch-line"></i> Total Trend</span>
            </div>
            <div class="mix-chart" style="--mix-height:${chartHeight}px">
              <div class="mix-columns">
                ${monthBuckets
                  .map((entry) => {
                    const upiHeight = Math.max((entry.upi / maxSeriesValue) * 100, 2);
                    const cashHeight = Math.max((entry.cash / maxSeriesValue) * 100, 2);
                    return `
                      <div class="mix-col">
                        <div class="mix-bars">
                          <span class="mix-bar primary" style="height:${upiHeight}%"></span>
                          <span class="mix-bar secondary" style="height:${cashHeight}%"></span>
                        </div>
                        <p class="mix-label">${entry.label}</p>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
              <svg class="mix-line-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true">
                <polyline class="mix-line" points="${linePoints}"></polyline>
                ${monthBuckets
                  .map((entry, index) => {
                    const x = xStart + index * xGap;
                    const y = yPad + (1 - entry.total / maxSeriesValue) * usableHeight;
                    return `<circle class="mix-dot" cx="${x}" cy="${y.toFixed(1)}" r="4"></circle>`;
                  })
                  .join("")}
              </svg>
            </div>
          </div>

          <div class="mix-right">
            <div class="mix-ring" style="--ring:${ringPercent}%">
              <div class="mix-ring-center">${ringPercent}%</div>
            </div>
            <h3>Rs ${Math.round(totalRevenue).toLocaleString()}</h3>
            <p class="mix-caption">Total Collected Revenue</p>
            <p class="mix-note">Live mix of UPI and cash with month-wise performance trend.</p>
          </div>
        </div>
      `;
    }

    if (byPlaceWrap) {
      const byPlace = PLACE_NAMES.map((placeName) => {
        const value = transactions
          .filter((entry) => entry.placeName === placeName)
          .reduce((sum, entry) => sum + entry.amount, 0);
        return { placeName, value };
      });
      const maxPlaceValue = Math.max(...byPlace.map((entry) => entry.value), 0);

      byPlaceWrap.innerHTML = byPlace
        .map((entry) => {
          const width = maxPlaceValue > 0 ? Math.max((entry.value / maxPlaceValue) * 100, 0) : 0;
          return `
            <div class="bar-row">
              <p class="bar-label">${entry.placeName}</p>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
              <p class="bar-value">Rs ${Math.round(entry.value)}</p>
            </div>
          `;
        })
        .join("");
    }

    if (byDayWrap) {
      const dayBuckets = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
        const value = transactions
          .filter((entry) => entry.date === key)
          .reduce((sum, entry) => sum + entry.amount, 0);
        dayBuckets.push({ key, label, value });
      }
      const maxDayValue = Math.max(...dayBuckets.map((entry) => entry.value), 0);

      byDayWrap.innerHTML = dayBuckets
        .map((entry) => {
          const width = maxDayValue > 0 ? Math.max((entry.value / maxDayValue) * 100, 0) : 0;
          return `
            <div class="bar-row">
              <p class="bar-label">${entry.label}</p>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
              <p class="bar-value">Rs ${Math.round(entry.value)}</p>
            </div>
          `;
        })
        .join("");
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.bookings || event.key === STORAGE_KEYS.settings) {
      renderRevenue();
    }
  });

  setInterval(renderRevenue, 2000);
  renderRevenue();
}

function renderAdminUsersPage() {
  const usersWrap = document.getElementById("adminUsersList");
  if (!usersWrap) return;

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  const meta = document.getElementById("adminUsersMeta");
  const logoutBtn = document.getElementById("adminUsersLogoutBtn");

  function renderUsers() {
    const users = getUsers().filter((entry) => entry.role === "user");
    if (meta) meta.textContent = `Total users: ${users.length}`;

    if (users.length === 0) {
      usersWrap.innerHTML = "<p>No users found.</p>";
      return;
    }

    const bookings = getBookings();
    usersWrap.innerHTML = users
      .map((entry) => {
        const userBookings = bookings.filter((booking) => booking.userId === entry.id);
        const activeCount = userBookings.filter((booking) => booking.status === "booked").length;
        const cancelledCount = userBookings.filter((booking) => booking.status === "cancelled").length;
        const netRevenue = userBookings.reduce(
          (sum, booking) => sum + getBookingNetRevenue(booking),
          0
        );
        return `
          <article class="list-card">
            <h4>${entry.name}</h4>
            <p>Email: ${entry.email}</p>
            <p>Registered: ${formatDate(entry.createdAt)}</p>
            <p>Total Bookings: ${userBookings.length}</p>
            <p>Active Bookings: ${activeCount}</p>
            <p>Cancelled Bookings: ${cancelledCount}</p>
            <p>Net Paid Revenue: Rs ${Math.round(netRevenue)}</p>
          </article>
        `;
      })
      .join("");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  window.addEventListener("storage", (event) => {
    if (
      event.key === STORAGE_KEYS.users ||
      event.key === STORAGE_KEYS.bookings ||
      event.key === STORAGE_KEYS.settings
    ) {
      renderUsers();
    }
  });

  setInterval(renderUsers, 2000);
  renderUsers();
}

function bindDemoCredentialNote() {
  const adminHint = document.getElementById("adminHint");
  if (!adminHint) return;
  adminHint.textContent = "Demo admin: admin@intellipark.com / admin123";
}

initSystem();
bindDemoCredentialNote();
renderLoginPage();
renderSignupPage();
renderForgotPasswordPage();
renderDashboardPage();
renderAdminPage();
renderNotificationsPage();
renderAdminNotificationsPage();
renderAdminReachMessagesPage();
renderAdminRevenuePage();
renderAdminUsersPage();
