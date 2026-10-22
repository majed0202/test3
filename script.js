/* =========================================================
   شفاء المتوسط للأدوية - Interactions
   ========================================================= */

(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Footer year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header: shadow line on scroll ---------- */
  const header = $("#siteHeader");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const menuToggle = $("#menuToggle");
  const nav = $("#primaryNav");

  function setMenu(open) {
    if (!menuToggle || !nav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      setMenu(!isOpen);
    });

    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuToggle.focus();
      }
    });

    window.matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Active section link ---------- */
  const navLinks = $$('.primary-nav a[href^="#"]');
  const sectionMap = new Map();
  navLinks.forEach((link) => {
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (target) sectionMap.set(target, link);
  });

  if ("IntersectionObserver" in window && sectionMap.size) {
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = sectionMap.get(entry.target);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((l) => l.classList.remove("is-current"));
            link.classList.add("is-current");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sectionMap.forEach((_, section) => activeObserver.observe(section));
  }

  /* ---------- Reveal on scroll (one quiet entrance per block) ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Animated counters in the hero ---------- */
  const counters = $$("[data-count]");
  function animateCount(el) {
    const target = Number(el.dataset.count);
    if (!target || reduceMotion) {
      el.textContent = target;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(frame);
    }
    el.textContent = "0";
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    const countObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => countObserver.observe(el));
  }

  /* ---------- Product search and filter ---------- */
  const searchInput = $("#productSearch");
  const filterButtons = $$(".filter-btn");
  const products = $$(".product");
  const emptyState = $("#emptyState");
  let activeFilter = "all";

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")   // remove Arabic diacritics
      .replace(/[أإآ]/g, "ا")                  // unify alef forms
      .replace(/ة/g, "ه")                      // unify taa marbuta
      .replace(/ى/g, "ي")                      // unify ya forms
      .trim();
  }

  function applyFilters() {
    const query = normalize(searchInput ? searchInput.value : "");
    let visible = 0;

    products.forEach((item) => {
      const matchesCat = activeFilter === "all" || item.dataset.cat === activeFilter;
      const haystack = normalize(item.dataset.name + " " + item.textContent);
      const matchesText = !query || haystack.includes(query);
      const show = matchesCat && matchesText;
      item.hidden = !show;
      if (show) visible++;
    });

    if (emptyState) emptyState.hidden = visible > 0;
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      filterButtons.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-pressed", String(isActive));
      });
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  /* ---------- Contact form validation ---------- */
  const form = $("#contactForm");
  const status = $("#formStatus");

  const rules = {
    name: {
      test: (v) => v.trim().length >= 3,
      message: "يرجى كتابة الاسم الكامل (3 أحرف على الأقل).",
    },
    email: {
      test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      message: "يرجى إدخال بريد إلكتروني صحيح.",
    },
    phone: {
      optional: true,
      test: (v) => /^[+0-9\s-]{7,20}$/.test(v.trim()),
      message: "يرجى إدخال رقم هاتف صحيح أو تركه فارغاً.",
    },
    topic: {
      test: (v) => v !== "",
      message: "يرجى اختيار نوع الطلب.",
    },
    message: {
      test: (v) => v.trim().length >= 10,
      message: "يرجى كتابة رسالة من 10 أحرف على الأقل.",
    },
    consent: {
      test: (_, el) => el.checked,
      message: "يلزم الموافقة قبل إرسال الرسالة.",
    },
  };

  function getField(name) {
    return form.elements.namedItem(name);
  }

  function validateField(name) {
    const field = getField(name);
    const rule = rules[name];
    if (!field || !rule) return true;

    const value = field.type === "checkbox" ? "" : field.value;
    const isEmptyOptional = rule.optional && value.trim() === "";
    const valid = isEmptyOptional || rule.test(value, field);

    const wrapper = field.closest(".field");
    const errorEl = form.querySelector(`[data-error-for="${name}"]`);

    if (wrapper) wrapper.classList.toggle("has-error", !valid);
    field.setAttribute("aria-invalid", String(!valid));
    if (errorEl) errorEl.textContent = valid ? "" : rule.message;

    return valid;
  }

  if (form) {
    Object.keys(rules).forEach((name) => {
      const field = getField(name);
      if (!field) return;
      const evt = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "blur";
      field.addEventListener(evt, () => validateField(name));
      field.addEventListener("input", () => {
        if (form.querySelector(`[data-error-for="${name}"]`)?.textContent) {
          validateField(name);
        }
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const names = Object.keys(rules);
      const results = names.map((name) => validateField(name));
      const firstInvalid = names.find((name, i) => !results[i]);

      if (firstInvalid) {
        status.textContent = "يرجى تصحيح الحقول المُعلَّمة أولاً.";
        status.classList.add("is-error");
        getField(firstInvalid).focus();
        return;
      }

      status.classList.remove("is-error");
      status.textContent = "جارٍ إرسال رسالتك...";

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      // Simulated request. Replace with a real endpoint (fetch POST) in production.
      setTimeout(() => {
        status.textContent = "شكراً لتواصلك معنا. سيرد عليك فريقنا خلال يومي عمل.";
        form.reset();
        names.forEach((name) => {
          const wrapper = getField(name)?.closest(".field");
          if (wrapper) wrapper.classList.remove("has-error");
        });
        submitBtn.disabled = false;
      }, 900);
    });
  }
})();
