console.log("Background script loaded");

async function generateMetadataWithOpenAI({ title, url, notes, apiKey }) {
  const prompt = `
Given the following bookmark information:
- Title: ${title}
- URL: ${url}
- Notes: ${notes || "None"}

Generate metadata in JSON format with the following fields:
{
  "Type": "Article | Video | Blog | Research | Documentation | Other",
  "Author/Creator": "Name of the author or website",
  "Topics/Tags": ["tag1", "tag2", ...],
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse OpenAI response:", err);
    return {};
  }
}


async function addPage({ url, title, notes }) {
  const { notionSecret, notionDatabaseId, openaiApiKey } = await browser.storage.sync.get([
    "notionSecret", "notionDatabaseId", "openaiApiKey"
  ]);

  if (!notionSecret || !notionDatabaseId || !openaiApiKey) {
    return { ok: false, error: "Missing Notion or OpenAI API credentials in Options." };
  }

  const now = new Date().toISOString();

  const aiMetadata = await generateMetadataWithOpenAI({
    title,
    url,
    notes,
    apiKey: openaiApiKey
  });  

  const properties = {
    Title: {
      title: [{ text: { content: title || url } }]
    },
    URL: { url },
    "Date Added": { date: { start: now } },
    ...(notes?.trim() && {
      Notes: { rich_text: [{ text: { content: notes.trim() } }] }
    }),
    ...(aiMetadata.Type && {
      Type: { select: { name: aiMetadata.Type } }
    }),
    ...(aiMetadata["Author/Creator"] && {
      "Author/Creator": { rich_text: [{ text: { content: aiMetadata["Author/Creator"] } }] }
    }),
    ...(aiMetadata.Status && {
      Status: { select: { name: aiMetadata.Status } }
    }),
    ...(aiMetadata["Topics/Tags"] && {
      "Topics/Tags": { multi_select: aiMetadata["Topics/Tags"].map(tag => ({ name: tag })) }
    }),
    ...(aiMetadata.Rating && {
      Rating: { number: aiMetadata.Rating }
    }),
    ...(aiMetadata["Date Completed"] && {
      "Date Completed": { date: { start: aiMetadata["Date Completed"] } }
    })
  };

  const payload = {
    parent: { database_id: notionDatabaseId },
    icon: { type: "emoji", emoji: "🔖" },
    properties
  };

  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionSecret}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `API ${response.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ADD_PAGE") {
    addPage(message.payload).then(result => sendResponse(result));
    return true; // Required for async sendResponse
  }
});
