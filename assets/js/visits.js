/*
  Counts a visit without collecting anything about the visitor.

  Sends one note to Jason's Google Sheet: the page path, the ref tag from
  the link (?ref=sig-photo, ?ref=sig-link, ...) and the domain of the page
  the visitor came from. No cookies, no storage, no IDs, no browser details.
  Skipped when the browser asks not to be tracked (Do Not Track or Global
  Privacy Control), for automated browsers, and when not on the live site.
*/
(function () {
  "use strict";

  var ENDPOINT = "https://script.google.com/macros/s/AKfycbygJ-O7p0Q2E9awyRGqD-IBERDnuVVtg1D6cp8LmM_GQqKD7BqPUb92xwBZd4bZOCVFFg/exec";
  var SITE = "jtsoukalas.github.io";

  var url = new URL(location.href);
  var ref = (url.searchParams.get("ref") || "").toLowerCase();

  // Tidy the address bar so a copied link doesn't carry the tag along
  if (url.searchParams.has("ref")) {
    url.searchParams.delete("ref");
    try { history.replaceState(history.state, "", url.pathname + url.search + url.hash); } catch (e) {}
  }

  if (location.hostname !== SITE) return;
  if (ENDPOINT.indexOf("https://script.google.com/") !== 0) return;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
  if (navigator.webdriver) return;

  // Only the domain of the previous page, and only if it was another site
  var from = "";
  try {
    var r = new URL(document.referrer);
    if (r.hostname !== SITE) from = r.hostname.replace(/^www\./, "");
  } catch (e) {}

  var body = JSON.stringify({
    p: location.pathname,
    r: /^[a-z0-9-]{1,32}$/.test(ref) ? ref : "",
    f: from,
    t: document.documentElement.dataset.page === "404" ? "404" : ""
  });

  // text/plain keeps this a simple request, and credentials: "omit" means
  // no Google cookies go along with it. The answer is never read.
  try {
    fetch(ENDPOINT, { method: "POST", mode: "no-cors", keepalive: true, credentials: "omit", headers: { "Content-Type": "text/plain" }, body: body });
  } catch (e) {}
})();
