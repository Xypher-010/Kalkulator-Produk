(function () {
  "use strict";

  const installButton = document.getElementById("installAppButton");
  let installPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service worker gagal didaftarkan.", error);
    });
  }

  if (!installButton) {
    return;
  }
  if (isStandalone()) {
    installButton.hidden = true;
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
})();
