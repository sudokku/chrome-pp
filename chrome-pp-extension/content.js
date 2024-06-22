let activeVideo = null;
let ignoreNextEvent = false;
let eventListeners = {
  play: null,
  pause: null,
  seeked: null
};

// Handshake with background.js
chrome.runtime.sendMessage({ type: "handshake" });

/**
 * Add event listeners to the video element
 * 
 * @param {chrome.runtime.Port} connectionPort 
 */
const addEventListeners = (connectionPort) => {
  // Save event listeners to remove them later
  eventListeners.play = () => {
    if (ignoreNextEvent) return;
    connectionPort.postMessage({ type: "play", time: activeVideo.currentTime });
  };
  eventListeners.pause = () => {
    if (ignoreNextEvent) return;
    connectionPort.postMessage({ type: "pause", time: activeVideo.currentTime });
  };
  eventListeners.seeked = () => {
    if (ignoreNextEvent) return;
    connectionPort.postMessage({ type: "seek", time: activeVideo.currentTime });
  };

  activeVideo.addEventListener("play", eventListeners.play);
  activeVideo.addEventListener("pause", eventListeners.pause);
  activeVideo.addEventListener("seeked", eventListeners.seeked);
};


/**
 * Remove event listeners from the video element
 */
const removeEventListeners = () => {
  activeVideo.removeEventListener("play", eventListeners.play);
  activeVideo.removeEventListener("pause", eventListeners.pause);
  activeVideo.removeEventListener("seeked", eventListeners.seeked);

  eventListeners = {
    play: null,
    pause: null,
    seeked: null
  };
};


/**
 * Handle messages from the background.js
 * 
 * @param {object} message 
 */
const handleBackgroundMessage = (message) => {
  switch (message.type) {
    case "play":
      ignoreNextEvent = true;
      activeVideo.currentTime = message.time;
      activeVideo.play().then(() => {
        setTimeout(() => { ignoreNextEvent = false; }, 100);
      });
      break;
    case "pause":
      ignoreNextEvent = true;
      activeVideo.currentTime = message.time;
      activeVideo.pause();
      setTimeout(() => { ignoreNextEvent = false; }, 100);
      break;
    case "seek":
      ignoreNextEvent = true;
      activeVideo.currentTime = message.time;
      setTimeout(() => { ignoreNextEvent = false; }, 100);
      break;
    case "exit":
      removeEventListeners();
      activeVideo.pause();
      break;
    case "error":
      removeEventListeners();
      activeVideo.pause();
      alert(message.message);
      break;
  }
};


/**
 * Listen for messages from the extension background
 * 
 * @param {object} message
 * @param {object} sender -> _ (unused)
 * @param {function} sendResponse
 */
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  // Fires when the popup is opened and background.js queries for video
  if (message.type === "queryVideo") {
    activeVideo = document.querySelector("video");
    sendResponse({
      type: "queryVideoResponse", data: {
        available: !!activeVideo,
      }
    });
  }

  // Fires when the popup starts a party and background.js propagates the message
  if (message.type === "startParty") {
    // Open a port connection with the background.js
    const port = chrome.runtime.connect({ name: "party-player-port" });
    port.onDisconnect.addListener(() => {
      activeVideo.pause();
      removeEventListeners();
    });
    addEventListeners(port);

    port.onMessage.addListener((message) => {
      handleBackgroundMessage(message);
    });
  }

  // Fires when the background.js recieved joined message from server
  if (message.type === "joinedParty") {
    activeVideo = document.querySelector("video");

    // Open a port connection with the background.js
    const port = chrome.runtime.connect({ name: "party-player-port" });
    port.onDisconnect.addListener(() => {
      activeVideo.pause();
      removeEventListeners();
    });
    addEventListeners(port);

    port.onMessage.addListener((message) => {
      handleBackgroundMessage(message);
    });
  }
});
