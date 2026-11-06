document.addEventListener('DOMContentLoaded', function () {
  // test option: ?now=2026-11-06T16:59:50Z starts the clock at that moment
  try { var n = new URLSearchParams(location.search).get('now'); if (n) Clock.setStart(n); } catch (e) {}
  Screens.init();
});
