(function () {
  const baseUrl = new URL('../node_modules/monaco-editor/min/vs/', window.location.href).toString();
  window.MonacoEnvironment = {
    getWorkerUrl: function () {
      const workerMain = baseUrl + 'base/worker/workerMain.js';
      const source = [
        "self.MonacoEnvironment = { baseUrl: '" + baseUrl + "' };",
        "importScripts('" + workerMain + "');"
      ].join('\\n');
      return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(source);
    }
  };

  require.config({ paths: { vs: baseUrl } });
  require.onError = function (err) {
    const details = err?.requireModules?.length ? ` modules: ${err.requireModules.join(', ')}` : '';
    console.error(`[monaco] AMD load failed: ${err?.message || err}${details}`);
  };

  window.monacoReady = new Promise((resolve, reject) => {
    require(['vs/editor/editor.main'], () => {
      require(['vs/basic-languages/python/python.contribution'], () => {
        resolve(window.monaco);
      }, reject);
    }, reject);
  });
})();
