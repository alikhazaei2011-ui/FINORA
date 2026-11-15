
/* =========================================
   FINORA - Personal Finance Manager
   ========================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "finora_data_v1";

const defaultData = {
  transactions: [],
  cards: [],
  goals: []
};

let data = loadData();
let activeFilter = "all";

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultData, ...JSON.parse(saved) } : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return new Intl.NumberFormat("fa-IR").format(Math.abs(value)) + " تومان";
}

function dateText(date) {
  return new Date(date).toLocaleDateString("fa-IR");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

/* Navigation */

function navigate(pageName) {
  const page = $("#" + pageName);
  if (!page) return;

  $$(".page").forEach(item => item.classList.remove("active"));
  page.classList.add("active");

  $$("[data-page]").forEach(item => {
    item.classList.toggle("active", item.dataset.page === pageName);
  });

  const titles = {
    dashboard: "داشبورد",
    transactions: "تراکنش‌ها",
    cards: "کارت‌های من",
    savings: "پس‌انداز",
    reports: "گزارش‌ها",
    settings: "تنظیمات"
  };

  const title = $("#page-title");
  if (title) title.textContent = titles[pageName] || "FINORA";

  renderAll();
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-page]");
  if (nav) {
    navigate(nav.dataset.page);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    handleAction(action.dataset.action);
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    activeFilter = filter.dataset.filter;
    renderTransactions();
    return;
  }

  const close = event.target.closest("[data-close-modal]");
  if (close) closeModal();
});

/* Modal */

function openModal(title, content) {
  const overlay = $("#modal-overlay");
  const box = $("#modal-box");

  if (!overlay || !box) return;

  box.innerHTML = `
    <div class="modal-header">
      <h3>${escapeHTML(title)}</h3>
      <button class="modal-close" type="button" data-close-modal>✕</button>
    </div>
    ${content}
  `;

  overlay.classList.add("show");
}

function closeModal() {
  $("#modal-overlay")?.classList.remove("show");
}

$("#modal-overlay")?.addEventListener("click", event => {
  if (event.target.id === "modal-overlay") closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

/* Actions */

function handleAction(action) {
  switch (action) {
    case "income":
      openTransactionModal("income");
      break;

    case "expense":
      openTransactionModal("expense");
      break;

    case "add-card":
      openCardModal();
      break;

    case "add-goal":
      openGoalModal();
      break;

    default:
      break;
  }
}

/* Transactions */

function openTransactionModal(type) {
  const isIncome = type === "income";

  openModal(
    isIncome ? "ثبت درآمد جدید" : "ثبت هزینه جدید",
    `
      <form id="transaction-form">
        <div class="form-grid">

          <div class="form-group full">
            <label>عنوان تراکنش</label>
            <input class="form-control" name="title"
              placeholder="مثلاً خرید، حقوق، هدیه..." required>
          </div>

          <div class="form-group">
            <label>مبلغ (تومان)</label>
            <input class="form-control" name="amount"
              type="number" min="1" placeholder="مثلاً 500000" required>
          </div>

          <div class="form-group">
            <label>دسته‌بندی</label>
            <select class="form-control" name="category">
              ${
                (isIncome
                  ? ["حقوق", "هدیه", "فروش", "سایر"]
                  : ["خوراک", "خرید", "حمل‌ونقل", "تفریح", "قبوض", "سایر"]
                ).map(item => `<option>${item}</option>`).join("")
              }
            </select>
          </div>

          <div class="form-group full">
            <label>تاریخ</label>
            <input class="form-control" name="date" type="date"
              value="${new Date().toISOString().slice(0, 10)}" required>
          </div>

          <div class="form-group full">
            <label>توضیحات (اختیاری)</label>
            <textarea class="form-control" name="note"
              placeholder="توضیحات بیشتر..."></textarea>
          </div>

        </div>

        <button class="btn btn-primary" type="submit"
          style="width:100%;margin-top:20px">
          ثبت تراکنش
        </button>
      </form>
    `
  );

  $("#transaction-form").addEventListener("submit", event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const amount = Number(form.get("amount"));

    if (!amount || amount <= 0) {
      showToast("مبلغ معتبر وارد کن");
      return;
    }

    data.transactions.unshift({
      id: crypto.randomUUID(),
      type,
      title: form.get("title").trim(),
      amount,
      category: form.get("category"),
      date: form.get("date"),
      note: form.get("note")
    });

    saveData();
    closeModal();
    renderAll();
    showToast("تراکنش با موفقیت ثبت شد");
  });
}

function deleteTransaction(id) {
  data.transactions = data.transactions.filter(item => item.id !== id);
  saveData();
  renderAll();
  showToast("تراکنش حذف شد");
}

/* Bank cards */

function openCardModal() {
  openModal("افزودن کارت بانکی", `
    <form id="card-form">
      <div class="form-grid">

        <div class="form-group full">
          <label>نام صاحب کارت</label>
          <input class="form-control" name="owner"
            placeholder="نام و نام خانوادگی" required>
        </div>

        <div class="form-group full">
          <label>نام بانک</label>
          <input class="form-control" name="bank"
            placeholder="مثلاً بانک ملت" required>
        </div>

        <div class="form-group full">
          <label>شماره کامل کارت</label>
          <input class="form-control" name="number"
            inputmode="numeric" maxlength="19"
            placeholder="0000 0000 0000 0000" required>
        </div>

        <div class="form-group">
          <label>تاریخ انقضا</label>
          <input class="form-control" name="expiry"
            placeholder="مثلاً 1408/05">
        </div>

      </div>

      <p style="font-size:11px;color:#d6af62;margin-top:15px;line-height:2">
        اطلاعات کارت فقط برای ثبت شخصی در این برنامه است.
        رمز اول، CVV2 و رمز یک‌بارمصرف را وارد نکن.
      </p>

      <button class="btn btn-primary" type="submit"
        style="width:100%;margin-top:18px">
        ذخیره کارت
      </button>
    </form>
  `);

  const numberInput = $('#card-form [name="number"]');

  numberInput.addEventListener("input", () => {
    let value = numberInput.value.replace(/\D/g, "").slice(0, 16);
    numberInput.value = value.replace(/(.{4})/g, "$1 ").trim();
  });

  $("#card-form").addEventListener("submit", event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const number = String(form.get("number")).replace(/\D/g, "");

    if (number.length !== 16) {
      showToast("شماره کارت باید ۱۶ رقم باشد");
      return;
    }

    data.cards.push({
      id: crypto.randomUUID(),
      owner: form.get("owner").trim(),
      bank: form.get("bank").trim(),
      number,
      expiry: form.get("expiry").trim()
    });

    saveData();
    closeModal();
    renderAll();
    showToast("کارت بانکی اضافه شد");
  });
}

function deleteCard(id) {
  data.cards = data.cards.filter(card => card.id !== id);
  saveData();
  renderAll();
  showToast("کارت حذف شد");
}

/* Savings goals */

function openGoalModal() {
  openModal("ایجاد هدف پس‌انداز", `
    <form id="goal-form">
      <div class="form-grid">

        <div class="form-group full">
          <label>عنوان هدف</label>
          <input class="form-control" name="title"
            placeholder="مثلاً خرید گوشی" required>
        </div>

        <div class="form-group">
          <label>مبلغ هدف (تومان)</label>
          <input class="form-control" name="target"
            type="number" min="1" required>
        </div>

        <div class="form-group">
          <label>مبلغ پس‌انداز فعلی</label>
          <input class="form-control" name="saved"
            type="number" min="0" value="0">
        </div>

      </div>

      <button class="btn btn-primary" type="submit"
        style="width:100%;margin-top:20px">
        ایجاد هدف
      </button>
    </form>
  `);

  $("#goal-form").addEventListener("submit", event => {
    event.preventDefault();

    const form = new FormData(event.target);
    const target = Number(form.get("target"));
    const saved = Number(form.get("saved"));

    if (!target || target <= 0 || saved < 0) {
      showToast("مقادیر واردشده معتبر نیستند");
      return;
    }

    data.goals.push({
      id: crypto.randomUUID(),
      title: form.get("title").trim(),
      target,
      saved
    });

    saveData();
    closeModal();
    renderAll();
    showToast("هدف پس‌انداز ایجاد شد");
  });
}

function addToGoal(id) {
  const goal = data.goals.find(item => item.id === id);
  if (!goal) return;

  openModal("افزایش پس‌انداز", `
    <form id="goal-add-form">
      <div class="form-group">
        <label>مبلغی که می‌خواهی اضافه کنی</label>
        <input class="form-control" name="amount"
          type="number" min="1" required placeholder="مبلغ به تومان">
      </div>

      <button class="btn btn-primary" type="submit"
        style="width:100%;margin-top:18px">
        ثبت مبلغ
      </button>
    </form>
  `);

  $("#goal-add-form").addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number(new FormData(event.target).get("amount"));

    if (!amount || amount <= 0) {
      showToast("مبلغ معتبر وارد کن");
      return;
    }

    goal.saved += amount;
    saveData();
    closeModal();
    renderAll();
    showToast("پس‌انداز به‌روزرسانی شد");
  });
}

function deleteGoal(id) {
  data.goals = data.goals.filter(goal => goal.id !== id);
  saveData();
  renderAll();
  showToast("هدف حذف شد");
}

/* Render dashboard */

function getTotals() {
  const income = data.transactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = data.transactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    income,
    expense,
    balance: income - expense
  };
}

function renderDashboard() {
  const totals = getTotals();

  const balance = $("#total-balance");
  const income = $("#total-income");
  const expense = $("#total-expense");

  if (balance) balance.textContent = money(totals.balance);
  if (income) income.textContent = money(totals.income);
  if (expense) expense.textContent = money(totals.expense);

  const recent = $("#recent-transactions");
  if (!recent) return;

  const items = data.transactions.slice(0, 5);

  recent.innerHTML = items.length
    ? items.map(transactionHTML).join("")
    : emptyHTML("هنوز تراکنشی ثبت نکرده‌ای", "💳");
}

/* Transaction list */

function transactionHTML(item) {
  const isIncome = item.type === "income";

  return `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-icon">
          ${isIncome ? "↙️" : "↗️"}
        </div>

        <div>
          <h4>${escapeHTML(item.title)}</h4>
          <p>${escapeHTML(item.category)} · ${dateText(item.date)}</p>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px">
        <span class="transaction-amount ${isIncome ? "green" : "red"}">
          ${isIncome ? "+" : "-"}${money(item.amount)}
        </span>

        <button class="icon-btn" type="button"
          title="حذف تراکنش"
          data-delete-transaction="${item.id}">×</button>
      </div>
    </div>
  `;
}

function renderTransactions() {
  const container = $("#all-transactions");
  if (!container) return;

  let items = [...data.transactions];

  if (activeFilter !== "all") {
    items = items.filter(item => item.type === activeFilter);
  }

  container.innerHTML = items.length
    ? items.map(transactionHTML).join("")
    : emptyHTML("تراکنشی برای نمایش وجود ندارد", "📋");
}

document.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete-transaction]");
  if (deleteButton) {
    deleteTransaction(deleteButton.dataset.deleteTransaction);
  }

  const deleteCardButton = event.target.closest("[data-delete-card]");
  if (deleteCardButton) {
    deleteCard(deleteCardButton.dataset.deleteCard);
  }

  const deleteGoalButton = event.target.closest("[data-delete-goal]");
  if (deleteGoalButton) {
    deleteGoal(deleteGoalButton.dataset.deleteGoal);
  }

  const addGoalButton = event.target.closest("[data-add-goal]");
  if (addGoalButton) {
    addToGoal(addGoalButton.dataset.addGoal);
  }
});

function emptyHTML(message, icon) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3>${message}</h3>
      <p>با ثبت اطلاعات، این قسمت به‌روزرسانی می‌شود.</p>
    </div>
  `;
}

/* Render cards */

function renderCards() {
  const container = $("#cards-container");
  if (!container) return;

  container.innerHTML = data.cards.length
    ? `
      <div class="stats-grid">
        ${data.cards.map(card => `
          <div class="bank-card">
            <div style="display:flex;justify-content:space-between">
              <h3>${escapeHTML(card.bank)}</h3>
              <span style="color:#d6af62">FINORA</span>
            </div>

            <div class="bank-card-number">
              ${escapeHTML(card.number.replace(/(.{4})/g, "$1 ").trim())}
            </div>

            <div class="bank-card-footer">
              <span>${escapeHTML(card.owner)}</span>
              <span>${escapeHTML(card.expiry || "")}</span>
            </div>

            <button class="btn btn-danger" type="button"
              style="margin-top:17px"
              data-delete-card="${card.id}">
              حذف کارت
            </button>
          </div>
        `).join("")}
      </div>
    `
    : emptyHTML("هنوز کارتی اضافه نکرده‌ای", "💳");
}

/* Render savings */

function renderSavings() {
  const container = $("#savings-container");
  if (!container) return;

  container.innerHTML = data.goals.length
    ? `
      <div class="stats-grid">
        ${data.goals.map(goal => {
          const percent = Math.min(100, goal.saved / goal.target * 100);

          return `
            <div class="card">
              <h3>${escapeHTML(goal.title)}</h3>

              <div style="margin-top:18px;font-size:12px;color:var(--muted)">
                ${money(goal.saved)} از ${money(goal.target)}
              </div>

              <div class="progress">
                <div class="progress-bar" style="width:${percent}%"></div>
              </div>

              <p class="gold">${Math.round(percent)}٪ تکمیل شده</p>

              <div style="display:flex;gap:8px;margin-top:15px;flex-wrap:wrap">
                <button class="btn btn-primary" type="button"
                  data-add-goal="${goal.id}">افزایش پس‌انداز</button>

                <button class="btn btn-danger" type="button"
                  data-delete-goal="${goal.id}">حذف</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `
    : emptyHTML("هنوز هدفی برای پس‌انداز نساخته‌ای", "🎯");
}

/* Reports */

function renderReports() {
  const container = $("#reports-container");
  if (!container) return;

  const totals = getTotals();
  const totalTransactions = data.transactions.length;

  const incomeCount = data.transactions.filter(t => t.type === "income").length;
  const expenseCount = data.transactions.filter(t => t.type === "expense").length;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">مجموع درآمد</div>
        <div class="stat-value green">${money(totals.income)}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">مجموع هزینه</div>
        <div class="stat-value red">${money(totals.expense)}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">مانده حساب</div>
        <div class="stat-value gold">${money(totals.balance)}</div>
      </div>
    </div>

    <div class="panel">
      <h3 style="margin-bottom:20px">خلاصه تراکنش‌ها</h3>

      <div class="transaction-item">
        <span>تعداد کل تراکنش‌ها</span>
        <strong>${totalTransactions.toLocaleString("fa-IR")}</strong>
      </div>

      <div class="transaction-item">
        <span>تعداد درآمدها</span>
        <strong class="green">${incomeCount.toLocaleString("fa-IR")}</strong>
      </div>

      <div class="transaction-item">
        <span>تعداد هزینه‌ها</span>
        <strong class="red">${expenseCount.toLocaleString("fa-IR")}</strong>
      </div>
    </div>
  `;
}

/* Settings */

function renderSettings() {
  const page = $("#settings");
  if (!page || page.dataset.initialized) return;

  page.dataset.initialized = "true";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h3 style="margin-bottom:15px">مدیریت اطلاعات</h3>

    <p style="color:var(--muted);line-height:2;margin-bottom:20px">
      اطلاعات FINORA در حافظه مرورگر همین دستگاه ذخیره می‌شود.
      برای نگهداری نسخه پشتیبان می‌توانی از اطلاعاتت خروجی بگیری.
    </p>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" id="export-data">دریافت نسخه پشتیبان</button>
      <button class="btn btn-secondary" id="import-data">بازیابی نسخه پشتیبان</button>
      <button class="btn btn-danger" id="clear-data">پاک کردن تمام اطلاعات</button>
    </div>

    <input type="file" id="import-file" accept=".json,application/json" hidden>
  `;

  page.appendChild(panel);

  $("#export-data").addEventListener("click", () => {
    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "FINORA-backup.json";
    link.click();
    URL.revokeObjectURL(url);

    showToast("نسخه پشتیبان آماده شد");
  });

  $("#import-data").addEventListener("click", () => {
    $("#import-file").click();
  });

  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());

      if (
        !Array.isArray(imported.transactions) ||
        !Array.isArray(imported.cards) ||
        !Array.isArray(imported.goals)
      ) {
        throw new Error("Invalid backup");
      }

      data = imported;
      saveData();
      renderAll();
      showToast("اطلاعات بازیابی شد");
    } catch {
      showToast("فایل پشتیبان معتبر نیست");
    }

    event.target.value = "";
  });

  $("#clear-data").addEventListener("click", () => {
    openModal("حذف تمام اطلاعات", `
      <p style="line-height:2;color:var(--muted)">
        آیا مطمئنی؟ تمام تراکنش‌ها، کارت‌ها و اهداف پس‌انداز حذف خواهند شد.
        این عملیات قابل بازگشت نیست.
      </p>

      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="btn btn-danger" id="confirm-clear">بله، حذف کن</button>
        <button class="btn btn-secondary" data-close-modal>انصراف</button>
      </div>
    `);

    $("#confirm-clear").addEventListener("click", () => {
      data = structuredClone(defaultData);
      saveData();
      closeModal();
      renderAll();
      showToast("اطلاعات پاک شد");
    });
  });
}

/* Render everything */

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderCards();
  renderSavings();
  renderReports();
  renderSettings();
}

/* Start app */

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  navigate("dashboard");
});
