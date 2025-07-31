document.getElementById("add").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "Saving…";

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const notes = document.getElementById("notes").value;

    // Send message to background to capture tab, classify, and push to Notion
    browser.runtime.sendMessage(
      {
        type: "ADD_PAGE",
        payload: {
          url: tab.url,
          title: tab.title,
          notes: notes
        }
      },
      (res) => {
        if (res && res.ok) {
          status.textContent = "✅ Added to Notion!";
          document.getElementById("notes").value = "";
        } else {
          status.textContent = "❌ Error: " + (res?.error || "Unknown");
        }
      }
    );
  } catch (e) {
    status.textContent = "Unexpected error: " + e.message;
  }
});

document.getElementById("open-options").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});
