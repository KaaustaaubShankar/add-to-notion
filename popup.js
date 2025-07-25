document.getElementById("add").addEventListener("click", async () => {
    const status = document.getElementById("status");
    status.textContent = "Saving…";
  
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const notes = document.getElementById("notes").value;
  
      const res = await browser.runtime.sendMessage({
        type: "ADD_PAGE",
        payload: { url: tab.url, title: tab.title, notes }
      });
  
      status.textContent = res.ok ? "✅ Added to Notion!" : `❌ Error: ${res.error}`;
      if (res.ok) document.getElementById("notes").value = "";
  
    } catch (e) {
      status.textContent = "Unexpected error: " + e.message;
    }
  });
  
  document.getElementById("open-options").addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });
  