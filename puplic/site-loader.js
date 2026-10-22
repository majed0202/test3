/* =========================================================
   Public site loader
   Reads contact info and image paths from Supabase and applies
   them to elements marked with data-cms attributes.

   Usage in the public site HTML (before this script):
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
   <script>
     window.SITE_CONFIG = {
       supabaseUrl: "https://fnbrgvpgyllfrnzjolul.supabase.co",
       supabaseAnonKey: "PASTE_ANON_PUBLIC_KEY_HERE",
       slug: "client-1",
       lang: "ar",           // "ar" | "en" | "tr"
       bucket: "site-images"
     };
   </script>
   <script src="site-loader.js"></script>

   Markup hooks:
   data-cms="phone|whatsapp|email|address"  -> sets text
   data-cms-href="phone|whatsapp|email"     -> sets href (tel:, wa.me, mailto:)
   data-cms-href="social.instagram"         -> sets href to the saved URL
   data-cms-img="logo|hero|about|service-1" -> sets img src
   Elements with no saved value are hidden.
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.SITE_CONFIG;
  if (!cfg || !window.supabase) return;

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  function hrefFor(type, value) {
    if (type === "phone") return "tel:" + value.replace(/\s/g, "");
    if (type === "email") return "mailto:" + value;
    if (type === "whatsapp") return "https://wa.me/" + value.replace(/\D/g, "");
    return value;
  }

  // Shared values ('all') first, then the current language overrides them.
  function mergeContacts(rows) {
    const merged = { social: {} };
    rows
      .slice()
      .sort((a, b) => (a.lang === "all" ? -1 : 1) - (b.lang === "all" ? -1 : 1))
      .forEach((row) => {
        ["phone", "whatsapp", "email", "address"].forEach((f) => {
          if (row[f]) merged[f] = row[f];
        });
        Object.entries(row.social || {}).forEach(([k, v]) => {
          if (v) merged.social[k] = v;
        });
      });
    return merged;
  }

  function apply(contacts, images) {
    document.querySelectorAll("[data-cms]").forEach((node) => {
      const value = contacts[node.dataset.cms];
      if (value) node.textContent = value;
      else node.hidden = true;
    });

    document.querySelectorAll("[data-cms-href]").forEach((node) => {
      const key = node.dataset.cmsHref;
      let value;
      if (key.startsWith("social.")) value = contacts.social[key.slice(7)];
      else value = contacts[key];

      if (value) {
        node.setAttribute("href", hrefFor(key, value));
      } else {
        node.hidden = true;
      }
    });

    document.querySelectorAll("img[data-cms-img]").forEach((img) => {
      const path = images[img.dataset.cmsImg];
      if (path) {
        img.src = sb.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
      }
    });
  }

  async function load() {
    try {
      const { data: site, error: siteErr } = await sb
        .from("sites")
        .select("id")
        .eq("slug", cfg.slug)
        .maybeSingle();
      if (siteErr || !site) return;

      const [contactsRes, imagesRes] = await Promise.all([
        sb.from("site_contacts").select("*").eq("site_id", site.id).in("lang", ["all", cfg.lang]),
        sb.from("site_images").select("key,path").eq("site_id", site.id)
      ]);

      const contacts = mergeContacts(contactsRes.data || []);
      const images = Object.fromEntries((imagesRes.data || []).map((r) => [r.key, r.path]));

      apply(contacts, images);
    } catch (err) {
      // Fail silently: the page keeps its default content.
      console.warn("Site content could not be loaded.", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
