// Send initial message to query for videos on DOM load
chrome.runtime.sendMessage({ type: "queryVideo" });

/**
 * Join a party by sending a message to the background.js
 */
document.getElementById("join").addEventListener("click", () => {
    const roomId = document.querySelector("input.room-id").value;

    if (!roomId) {
        alert("Please enter a room ID.");
        return;
    }

    chrome.runtime.sendMessage({ type: "joinParty", data: { id: roomId } });
});

/**
 * Listen for messages from the extension background
 * 
 * @param {object} message
 * @param {object} sender -> _ (unused)
 * @param {function} sendResponse
 */
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.type === "queryVideoResponse") {
        document.querySelector(".init img").classList.add("hidden");
        const availableVideo = document.querySelector("p.available-video");
        const startPartyButton = document.getElementById("start");

        if (message.data.available) {
            availableVideo.textContent = message.data.tabTitle;
            startPartyButton.disabled = false;
            startPartyButton.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    type: "startParty",
                    data: message.data
                });
            });
        } else {
            availableVideo.textContent = "No video found. Try running it in a tab with video element.";
            startPartyButton.disabled = true;
        }
    }

    if (message.type === "activePartyResponse") {
        const party = message.data;
        document.querySelector(".init").classList.add("hidden");
        document.querySelector(".active-party").classList.remove("hidden");

        document.querySelector(".active-video").textContent = party.tabTitle;
        document.querySelector(".party-code").textContent = party.id;
        document.getElementById("exit").addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "exitParty" });
            window.close();
        });
    }
});