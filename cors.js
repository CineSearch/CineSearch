const xhrRequestHook = (options) => {
  const originalUri = options.uri;
  options.uri = applyCorsProxy(originalUri);
  return options;
};

function setupVideoJsXhrHook() {
  if (typeof videojs === "undefined" || !videojs.Vhs) {
    return;
  }

  if (requestHookInstalled) {
    return;
  }

  videojs.Vhs.xhr.onRequest(xhrRequestHook);
  requestHookInstalled = true;
}

function removeVideoJsXhrHook() {
  if (
    typeof videojs !== "undefined" &&
    videojs.Vhs &&
    requestHookInstalled
  ) {
    videojs.Vhs.xhr.offRequest(xhrRequestHook);
    requestHookInstalled = false;
  }
}

const originalconsoleWarn = console.warn;
console.warn = function (...args) {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("videojs.mergeOptions is deprecated") ||
      message.includes("MouseEvent.mozPressure") ||
      message.includes("MouseEvent.mozInputSource"))
  ) {
    return;
  }
  originalconsoleWarn.apply( console, args);
};