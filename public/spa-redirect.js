// GitHub Pages serves 404.html for deep links; it redirects to the app with ?redirect=<path>.
// Restore that path before the app starts. Kept in a file (not inline) for the CSP.
(function () {
  var redirect = new URLSearchParams(window.location.search).get('redirect');
  if (redirect) {
    var cleanRedirect = redirect.replace(/^\/+/, '');
    window.history.replaceState(null, '', '/toots-scheduler/' + cleanRedirect);
  }
})();
