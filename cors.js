const xhrRequestHook = (options) => {
  const originalUri = options.uri;
  console.log('🔧 cors.js - xhrRequestHook - URL originale:', originalUri);
  
  const proxiedUri = applyCorsProxy(originalUri);
  console.log('🔧 cors.js - xhrRequestHook - URL con proxy:', proxiedUri);
  
  options.uri = proxiedUri;
  return options;
};

function setupVideoJsXhrHook() {
  console.log('🔧 cors.js - setupVideoJsXhrHook chiamata');
  
  if (typeof videojs === "undefined" || !videojs.Vhs) {
    console.log('🔧 cors.js - Video.js o VHS non disponibile');
    return;
  }

  if (requestHookInstalled) {
    console.log('🔧 cors.js - Hook già installato');
    return;
  }

  videojs.Vhs.xhr.onRequest(xhrRequestHook);
  requestHookInstalled = true;
  console.log('🔧 cors.js - Hook installato con successo');
}

function removeVideoJsXhrHook() {
  console.log('🔧 cors.js - removeVideoJsXhrHook chiamata');
  
  if (
    typeof videojs !== "undefined" &&
    videojs.Vhs &&
    requestHookInstalled
  ) {
    videojs.Vhs.xhr.offRequest(xhrRequestHook);
    requestHookInstalled = false;
    console.log('🔧 cors.js - Hook rimosso');
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