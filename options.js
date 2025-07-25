async function load() {
    const {
      notionSecret,
      notionDatabaseId,
      notionNotesProp,
      openaiApiKey
    } = await browser.storage.sync.get([
      "notionSecret",
      "notionDatabaseId",
      "notionNotesProp",
      "openaiApiKey"
    ]);
  
    if (notionSecret) document.getElementById("secret").value = notionSecret;
    if (notionDatabaseId) document.getElementById("db").value = notionDatabaseId;
    if (notionNotesProp) document.getElementById("notesProp").value = notionNotesProp;
    if (openaiApiKey) document.getElementById("openaiKey").value = openaiApiKey;
  }
  load();
  
  document.getElementById("save").addEventListener("click", async () => {
    await browser.storage.sync.set({
      notionSecret: document.getElementById("secret").value.trim(),
      notionDatabaseId: document.getElementById("db").value.trim(),
      notionNotesProp: document.getElementById("notesProp").value.trim() || "Notes",
      openaiApiKey: document.getElementById("openaiKey").value.trim()
    });
    alert("✅ Saved!");
  });
  