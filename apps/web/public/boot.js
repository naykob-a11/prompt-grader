// Plain ES5 outside the bundle, so it still runs when the bundle cannot load or parse. It replaces
// the placeholder in index.html with what went wrong; React removes the placeholder on start.
/* global caches, document, location, navigator, setTimeout, window */
(function () {
  var WAIT_MS = 20000;

  function add(parent, tag, text) {
    var element = document.createElement(tag);
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  // A stuck service worker can keep serving a broken version, so a retry starts clean.
  function reloadClean() {
    var done = function () {
      location.reload();
    };
    var clear = function () {
      if (!window.caches) return done();
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              return caches.delete(key);
            }),
          );
        })
        .then(done, done);
    };
    if (!navigator.serviceWorker) return clear();
    navigator.serviceWorker
      .getRegistrations()
      .then(function (list) {
        return Promise.all(
          list.map(function (item) {
            return item.unregister();
          }),
        );
      })
      .then(clear, clear);
  }

  function show(detail) {
    var boot = document.getElementById('boot');
    if (!boot || boot.getAttribute('role')) return;
    boot.textContent = '';
    boot.setAttribute('role', 'alert');
    add(boot, 'h1', 'เปิดแอปไม่สำเร็จ');
    add(
      boot,
      'p',
      'ลองอัปเดตเบราว์เซอร์แล้วโหลดใหม่ ถ้ายังไม่ได้ ให้ส่งข้อความด้านล่างนี้ให้ผู้ดูแล',
    );
    add(boot, 'code', detail + ' · ' + navigator.userAgent);
    var button = add(boot, 'button', 'ล้างแคชแล้วโหลดใหม่');
    button.type = 'button';
    button.className = 'primary';
    button.onclick = reloadClean;
  }

  window.addEventListener(
    'error',
    function (event) {
      var target = event.target;
      var failedFile = target && target !== window && (target.src || target.href);
      show(failedFile ? 'load failed: ' + failedFile : event.message || 'unknown error');
    },
    true,
  );

  setTimeout(function () {
    show('timed out');
  }, WAIT_MS);
})();
