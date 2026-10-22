/* =========================================================
   Admin panel logic
   Security is enforced by Supabase RLS policies, not by this file.
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.ADMIN_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const SLOTS = [
    { key: "logo",      label: "شعار الموقع",            hint: "يفضل خلفية شفافة (PNG)" },
    { key: "hero",      label: "صورة الواجهة الرئيسية",   hint: "عرض مثالي 1600 بكسل أو أكثر" },
    { key: "about",     label: "صورة قسم من نحن",         hint: "" },
    { key: "service-1", label: "صورة الخدمة الأولى",      hint: "" },
    { key: "service-2", label: "صورة الخدمة الثانية",     hint: "" },
    { key: "service-3", label: "صورة الخدمة الثالثة",     hint: "" }
  ];

  const CONTACT_FIELDS = ["phone", "whatsapp", "email", "address", "instagram", "facebook", "x", "linkedin", "tiktok"];
  const SOCIAL_FIELDS = ["instagram", "facebook", "x", "linkedin", "tiktok"];
  const LANG_LABELS = { all: "مشترك لكل اللغات", ar: "العربية", en: "English", tr: "Türkçe" };
  const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  const state = {
    siteId: null,
    contacts: {},   // rows keyed by lang
    images: {},     // rows keyed by image key
    pendingFiles: {}
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- UI helpers ---------- */

  function show(view) {
    $("#authView").hidden = view !== "auth";
    $("#appView").hidden = view !== "app";
  }

  let toastTimer;
  function toast(message, type = "success") {
    const el = $("#toast");
    el.textContent = message;
    el.className = "toast toast-" + type;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4000);
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = busyText || "جارٍ الحفظ...";
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
    }
    btn.disabled = busy;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.append(c));
    return node;
  }

  /* ---------- Auth ---------- */

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    const errorEl = $("#loginError");
    errorEl.textContent = "";

    if (!email || !password) {
      errorEl.textContent = "أدخل البريد الإلكتروني وكلمة المرور.";
      return;
    }

    const btn = e.submitter || $("#loginForm button[type=submit]");
    setBusy(btn, true, "جارٍ الدخول...");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(btn, false);

    if (error) {
      // Generic message on purpose: do not reveal whether the email exists.
      errorEl.textContent = "بيانات الدخول غير صحيحة، أو الحساب غير مفعّل.";
      return;
    }
    $("#loginPassword").value = "";
    await enter();
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await sb.auth.signOut();
    state.siteId = null;
    state.contacts = {};
    state.images = {};
    state.pendingFiles = {};
    show("auth");
  });

  async function enter() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      show("auth");
      return;
    }

    $("#userEmail").textContent = session.user.email;
    show("app");

    const { data: sites, error } = await sb.from("sites").select("id,name,slug").order("name");
    const select = $("#siteSelect");
    select.innerHTML = "";

    if (error || !sites || sites.length === 0) {
      toast("لا تملك صلاحية على أي موقع. تواصل مع الدعم.", "error");
      return;
    }

    sites.forEach((s) => select.append(new Option(s.name, s.id)));
    await selectSite(sites[0].id);
  }

  /* ---------- Site loading ---------- */

  $("#siteSelect").addEventListener("change", (e) => selectSite(e.target.value));

  async function selectSite(siteId) {
    state.siteId = siteId;
    state.pendingFiles = {};
    await Promise.all([loadContacts(), loadImages()]);
    fillContactForm();
    renderSlots();
  }

  async function loadContacts() {
    const { data, error } = await sb.from("site_contacts").select("*").eq("site_id", state.siteId);
    if (error) return toast("تعذّر تحميل معلومات التواصل.", "error");
    state.contacts = Object.fromEntries((data || []).map((r) => [r.lang, r]));
  }

  async function loadImages() {
    const { data, error } = await sb.from("site_images").select("*").eq("site_id", state.siteId);
    if (error) return toast("تعذّر تحميل الصور.", "error");
    state.images = Object.fromEntries((data || []).map((r) => [r.key, r]));
  }

  /* ---------- Tabs ---------- */

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });
      $("#tab-contacts").hidden = tab.dataset.tab !== "contacts";
      $("#tab-images").hidden = tab.dataset.tab !== "images";
    });
  });

  /* ---------- Contacts ---------- */

  function fillContactForm() {
    const lang = $("#contactLang").value;
    const row = state.contacts[lang] || {};
    const form = $("#contactForm");

    CONTACT_FIELDS.filter((f) => !SOCIAL_FIELDS.includes(f)).forEach((f) => {
      form.elements[f].value = row[f] || "";
    });
    SOCIAL_FIELDS.forEach((f) => {
      form.elements[f].value = (row.social && row.social[f]) || "";
    });

    $("#contactHint").textContent = lang === "all"
      ? "هذه القيم تظهر في كل اللغات ما لم تُخصَّص لغة معينة."
      : "القيم هنا تُطبَّق على " + LANG_LABELS[lang] + " وتتقدّم على القيم المشتركة.";

    clearContactErrors();
  }

  $("#contactLang").addEventListener("change", fillContactForm);

  const RULES = {
    phone:     { test: (v) => !v || /^\+?[0-9\s()-]{7,25}$/.test(v), msg: "رقم هاتف غير صالح." },
    whatsapp:  { test: (v) => !v || /^\+?[0-9]{8,15}$/.test(v.replace(/[\s-]/g, "")), msg: "رقم واتساب غير صالح (أرقام فقط مع رمز الدولة)." },
    email:     { test: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), msg: "بريد إلكتروني غير صالح." },
    address:   { test: (v) => v.length <= 200, msg: "العنوان طويل جداً." }
  };
  SOCIAL_FIELDS.forEach((f) => {
    RULES[f] = {
      test: (v) => !v || /^https:\/\/[^\s]+\.[^\s]+$/.test(v),
      msg: "يجب أن يبدأ الرابط بـ https://"
    };
  });

  function clearContactErrors() {
    $$("[data-err]").forEach((n) => (n.textContent = ""));
    $$("#contactForm .field").forEach((f) => f.classList.remove("has-error"));
  }

  function validateContacts() {
    const form = $("#contactForm");
    let valid = true;
    clearContactErrors();

    Object.entries(RULES).forEach(([name, rule]) => {
      const input = form.elements[name];
      const value = input.value.trim();
      if (!rule.test(value)) {
        valid = false;
        const errEl = $(`[data-err="${name}"]`);
        if (errEl) errEl.textContent = rule.msg;
        input.closest(".field").classList.add("has-error");
      }
    });
    return valid;
  }

  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateContacts()) {
      toast("يرجى تصحيح الحقول المُعلَّمة قبل الحفظ.", "error");
      return;
    }

    const form = $("#contactForm");
    const lang = $("#contactLang").value;
    const social = {};
    SOCIAL_FIELDS.forEach((f) => {
      const v = form.elements[f].value.trim();
      if (v) social[f] = v;
    });

    const payload = {
      site_id: state.siteId,
      lang,
      phone: form.elements.phone.value.trim() || null,
      whatsapp: form.elements.whatsapp.value.trim() || null,
      email: form.elements.email.value.trim() || null,
      address: form.elements.address.value.trim() || null,
      social,
      updated_at: new Date().toISOString()
    };

    const btn = $("#saveContactsBtn");
    setBusy(btn, true);
    const { data, error } = await sb
      .from("site_contacts")
      .upsert(payload, { onConflict: "site_id,lang" })
      .select()
      .single();
    setBusy(btn, false);

    if (error) {
      toast("تعذّر حفظ التعديلات. حاول مرة أخرى.", "error");
      return;
    }
    state.contacts[lang] = data;
    toast("تم حفظ معلومات التواصل وستظهر على الموقع مباشرة.");
  });

  /* ---------- Images ---------- */

  function imagePublicUrl(path) {
    return sb.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
  }

  function renderSlots() {
    const wrap = $("#slots");
    wrap.innerHTML = "";

    SLOTS.forEach((slot) => {
      const current = state.images[slot.key];
      const pending = state.pendingFiles[slot.key];

      const preview = el("img", {
        class: "slot-preview",
        alt: slot.label,
        loading: "lazy"
      });
      if (pending) preview.src = pending.objectUrl;
      else if (current) preview.src = imagePublicUrl(current.path);
      else preview.classList.add("is-empty");

      const input = el("input", {
        type: "file",
        accept: "image/jpeg,image/png,image/webp",
        id: "file-" + slot.key
      });
      const fileLabel = el("label", { class: "btn btn-ghost btn-sm file-btn", for: "file-" + slot.key, text: "اختيار صورة" });

      const saveBtn = el("button", {
        type: "button",
        class: "btn btn-primary btn-sm",
        text: "حفظ الصورة",
        disabled: "disabled"
      });
      if (pending) saveBtn.disabled = false;

      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        const problem = await checkImage(file);
        if (problem) {
          toast(problem, "error");
          input.value = "";
          return;
        }
        if (state.pendingFiles[slot.key]) URL.revokeObjectURL(state.pendingFiles[slot.key].objectUrl);
        state.pendingFiles[slot.key] = { file, objectUrl: URL.createObjectURL(file) };
        renderSlots();
      });

      saveBtn.addEventListener("click", () => saveImage(slot, saveBtn));

      const cancelBtn = pending
        ? el("button", { type: "button", class: "btn btn-ghost btn-sm", text: "إلغاء" })
        : null;
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          URL.revokeObjectURL(pending.objectUrl);
          delete state.pendingFiles[slot.key];
          renderSlots();
        });
      }

      const card = el("article", { class: "slot" }, [
        el("h3", { text: slot.label }),
        slot.hint ? el("p", { class: "muted small", text: slot.hint }) : el("span"),
        preview,
        el("p", { class: "muted small", text: pending ? "صورة جديدة بانتظار الحفظ" : (current ? "الصورة الحالية منشورة" : "لا توجد صورة بعد") }),
        el("div", { class: "slot-actions" }, [fileLabel, input, saveBtn, ...(cancelBtn ? [cancelBtn] : [])])
      ]);

      wrap.append(card);
    });
  }

  function checkImage(file) {
    return new Promise((resolve) => {
      if (!MIME_EXT[file.type]) {
        return resolve("نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.");
      }
      if (file.size > cfg.maxImageBytes) {
        return resolve("حجم الصورة يتجاوز 2 ميغابايت.");
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.naturalWidth < cfg.minImageWidth) {
          resolve("عرض الصورة صغير جداً، الحد الأدنى " + cfg.minImageWidth + " بكسل.");
        } else {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("تعذّر قراءة الملف. تأكد أنه صورة سليمة.");
      };
      img.src = url;
    });
  }

  async function saveImage(slot, btn) {
    const pending = state.pendingFiles[slot.key];
    if (!pending) return;

    setBusy(btn, true, "جارٍ الرفع...");

    // New unique name = browsers and CDNs never serve the old file from cache.
    const ext = MIME_EXT[pending.file.type];
    const path = `${state.siteId}/${slot.key}-${Date.now()}.${ext}`;

    const up = await sb.storage.from(cfg.bucket).upload(path, pending.file, {
      cacheControl: "31536000",
      contentType: pending.file.type,
      upsert: false
    });
    if (up.error) {
      setBusy(btn, false);
      toast("تعذّر رفع الصورة. تحقق من الاتصال وحاول مجدداً.", "error");
      return;
    }

    const oldPath = state.images[slot.key] && state.images[slot.key].path;

    const { data, error } = await sb
      .from("site_images")
      .upsert(
        { site_id: state.siteId, key: slot.key, path, updated_at: new Date().toISOString() },
        { onConflict: "site_id,key" }
      )
      .select()
      .single();

    if (error) {
      // Roll back the uploaded file so storage does not fill with orphans.
      await sb.storage.from(cfg.bucket).remove([path]);
      setBusy(btn, false);
      toast("تعذّر حفظ الصورة في قاعدة البيانات.", "error");
      return;
    }

    // Remove the previous file only after the new path is saved.
    if (oldPath && oldPath !== path) {
      await sb.storage.from(cfg.bucket).remove([oldPath]);
    }

    URL.revokeObjectURL(pending.objectUrl);
    delete state.pendingFiles[slot.key];
    state.images[slot.key] = data;
    renderSlots();
    toast("تم تحديث الصورة وستظهر على الموقع مباشرة.");
  }

  /* ---------- Start ---------- */

  enter();
})();
