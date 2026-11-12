/* LexReader v8 — theme engine, shared by every screen + the gallery shell.
   Must run synchronously, before first paint, so there is no flash:
   each screen includes it as the very first thing inside <helmet>,
   ahead of its own <style> and of design-system.css.

   Storage contract: localStorage['lexreader-theme'] is 'light' | 'dark'
   when the user picked one explicitly, or absent when following the
   system preference. Absent is the default — design-system.css already
   handles that case on its own via prefers-color-scheme, so the "system"
   mode needs no attribute at all. */
(function () {
  function apply(saved) {
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
  var saved = null;
  try { saved = localStorage.getItem("lexreader-theme"); } catch (e) {}
  apply(saved);

  window.LexTheme = {
    get: function () {
      try { return localStorage.getItem("lexreader-theme") || "system"; }
      catch (e) { return "system"; }
    },
    set: function (mode) {
      try {
        if (mode === "system") { localStorage.removeItem("lexreader-theme"); }
        else { localStorage.setItem("lexreader-theme", mode); }
      } catch (e) {}
      apply(mode === "system" ? null : mode);
      window.dispatchEvent(new CustomEvent("lextheme-change", { detail: { mode: mode } }));
    },
    effective: function () {
      var attr = document.documentElement.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") return attr;
      try {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch (e) { return "light"; }
    }
  };
})();
