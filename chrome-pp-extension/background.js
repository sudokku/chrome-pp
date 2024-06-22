let ws = null;
let activeParty = null;


/**
 * Party class; a unified object to store party information
 * 
 * @param {string} id - The unique ID of the party
 * @param {number} tabId - The tab ID of the active tab
 * @param {string} tabTitle - The title of the active tab
 * @param {string} url - The URL of the active tab
 * @param {chrome.runtime.Port} port - The port connection to the content script
 * 
 * @method setTabId - Set the tab ID of the active tab
 * @method setTabTitle - Set the title of the active tab
 * @method setUrl - Set the URL of the active tab
 * @method setPort - Set the port connection to the content script
 */
class Party {
  constructor(tabId, tabTitle, url) {
    this.id = Math.random().toString(36).substring(2, 15);
    this.tabId = tabId;
    this.tabTitle = tabTitle;
    this.url = url;
    this.port = null;
  }

  setId(roomId) {
    this.id = roomId;
  }

  setTabId(tabId) {
    this.tabId = tabId;
  }

  setTabTitle(tabTitle) {
    this.tabTitle = tabTitle;
  }

  setUrl(url) {
    this.url = url;
  }

  setPort(port) {
    this.port = port;
  }
}


/**
 * Initialize WebSocket connection when the extension is started
 */
function initializeWebSocket() {
  ws = new WebSocket("ws://localhost:3000");

  ws.onopen = function () {
    console.log("WebSocket connection opened.");

    ws.send(JSON.stringify({
      type: "join",
      roomId: activeParty.id,
      content: activeParty.url
    }));
  };

  ws.onmessage = function (message) {
    const payload = JSON.parse(message.data);
    console.log("WebSocket message:", payload);

    // Check if joined external party by roomId (has no tab opened) 
    if (payload.type === "joined" && !activeParty.url) {
      console.log("Joined external party.")
      // Create a new tab from url
      chrome.tabs.create({ url: payload.url })
        .then((tab) => {
          activeParty.setTabId(tab.id);
          activeParty.setTabTitle(tab.title);
          activeParty.setUrl(tab.url);
        })
        .catch((error) => { console.error("Error creating tab:", error); });
      return;
    } else if (payload.type === "message" && activeParty.port) {
      activeParty.port.postMessage(payload.content);
    }
  };

  ws.onclose = function () {
    console.log("WebSocket connection closed.");

    if (activeParty && activeParty.port)
      activeParty.port.disconnect();
    activeParty = null;
  };

  ws.onerror = function (error) {
    console.error("WebSocket error:", error.message);

    activeParty.port.postMessage({ type: "error", message: "WebSocket error. " + error.message });
    activeParty.port.disconnect();
    activeParty = null;
  };
}


/**
 * Listen for messages from the extension popup and content script
 * 
 * @param {object} message
 * @param {object} sender -> _ (unused)
 * @param {function} sendResponse
*/
chrome.runtime.onMessage.addListener((message, _, _sendResponse) => {
  // Fires when the popup is opened
  if (message.type === "queryVideo") {
    console.log("Querying for video...");

    // If there is an active party, send a message to the popup script
    if (activeParty) {
      chrome.runtime.sendMessage({
        type: "activePartyResponse",
        data: activeParty
      });
      return;
    }

    // Send a message to the content script to query for video
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "queryVideo" }, (response) => {
        // Send the queryVideoResponse back to the popup
        chrome.runtime.sendMessage({
          type: "queryVideoResponse", data: {
            available: response.data.available,
            tabId: tabs[0].id,
            tabTitle: tabs[0].title,
            url: tabs[0].url
          }
        });
      });
    });
  }

  // Fires when the user clicks on a video in the popup
  if (message.type === "startParty") {
    console.log("Starting party...");

    // Create a new party object
    activeParty = new Party(message.data.tabId, message.data.tabTitle, message.data.url);

    // Intialize a WebSocket connection
    initializeWebSocket();

    // Send a message to the content script to start listenting for party events
    chrome.tabs.sendMessage(activeParty.tabId, { type: "startParty", data: activeParty });
    chrome.runtime.sendMessage({
      type: "activePartyResponse",
      data: activeParty
    });
  }

  // Fires when the user clicks on the join button in the popup
  if (message.type === "joinParty") {
    console.log("Joining party...");

    // Create a new party object
    activeParty = new Party(null, null, null);
    activeParty.setId(message.data.id);

    // Intialize a WebSocket connection
    initializeWebSocket();
  }

  // Fires when the user clicks on the exit button in the popup
  if (message.type === "exitParty") {
    console.log("Exiting party...");

    // Send a message to the content script to stop listening for party events
    activeParty.port.postMessage({ type: "exit" });

    // Close the WebSocket connection
    ws.close();
  }

  // Fires when the content script sends a handshake message to confirm the party connection
  if (message.type === "handshake" && activeParty && !activeParty.port) {
    chrome.tabs.sendMessage(activeParty.tabId, { type: "joinedParty", data: activeParty });
  }
});


/**
 * Listen for port connections from the extension content script
 * 
 * @param {(chrome.runtime.Port) => {function}} port
 */
chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === "party-player-port");

  port.onMessage.addListener((message) => {
    ws.send(JSON.stringify({
      type: "message",
      roomId: activeParty.id,
      content: message
    }));
  });

  // Listen for port disconnections from the extension content script
  port.onDisconnect.addListener(() => {
    console.log("Port disconnected.");
    chrome.tabs.sendMessage(activeParty.tabId, { type: "exitParty" });
    activeParty = null;
    ws.close();
  });

  activeParty.setPort(port);
});
