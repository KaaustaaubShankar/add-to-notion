console.log("Background script loaded");

async function captureScreenshot() {
  return new Promise((resolve, reject) => {
    browser.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (browser.runtime.lastError) {
        reject(browser.runtime.lastError.message);
      } else {
        resolve(dataUrl); // e.g. data:image/png;base64,...
      }
    });
  });
}

function cleanJsonResponse(text) {
  return text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
}

async function generateMetadataFromScreenshot(base64Image, apiKey) {
  const prompt = `
Analyze this screenshot of a webpage and extract only the following metadata in JSON format:

{
  "Title": "Page title or main heading",
  "Type": "Article | Video | Blog | Research | Documentation | Other",
  "Author/Creator": "Name of the author or website"
}

Respond ONLY with valid JSON, no explanations or extra text.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      temperature: 0.5,
    })
  });

  const data = await response.json();
  try {
    const cleaned = cleanJsonResponse(data.choices[0].message.content);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse screenshot metadata:", err, data.choices[0].message.content);
    return {};
  }
}

// Minimal fallback metadata generator: just returns title/url and empty placeholders
function generateBasicMetadata({ title, url, notes }) {
  return {
    Title: title || url,
    Type: null,
    "Author/Creator": null,
    Status: null,
    "Topics/Tags": [],
    Rating: null,
    "Date Completed": null,
    URL: url,
    Notes: notes || ""
  };
}

async function addPage({ url, title, notes }) {
  const { notionSecret, notionDatabaseId, openaiApiKey } = await browser.storage.sync.get([
    "notionSecret", "notionDatabaseId", "openaiApiKey"
  ]);

  if (!notionSecret || !notionDatabaseId || !openaiApiKey) {
    return { ok: false, error: "Missing Notion or OpenAI API credentials in Options." };
  }

  const now = new Date().toISOString();

  let screenshotMetadata = {};
  try {
    const base64Image = await captureScreenshot();
    screenshotMetadata = await generateMetadataFromScreenshot(base64Image, openaiApiKey);
  } catch (err) {
    console.warn("Screenshot metadata generation failed, falling back to basic metadata only", err);
  }

  const textMetadata = generateBasicMetadata({ title, url, notes });

  // Use screenshot title if available, otherwise fallback to passed title
  const finalTitle = screenshotMetadata.Title || textMetadata.Title;

  const properties = {
    Title: {
      title: [{ text: { content: finalTitle } }]
    },
    URL: { url: textMetadata.URL },
    "Date Added": { date: { start: now } },
    ...(textMetadata.Notes?.trim() && {
      Notes: { rich_text: [{ text: { content: textMetadata.Notes.trim() } }] }
    }),
    ...(screenshotMetadata.Type && {
      Type: { select: { name: screenshotMetadata.Type } }
    }),
    ...(screenshotMetadata["Author/Creator"] && {
      "Author/Creator": { rich_text: [{ text: { content: screenshotMetadata["Author/Creator"] } }] }
    }),
    ...(textMetadata.Status && {
      Status: { select: { name: textMetadata.Status } }
    }),
    ...(textMetadata["Topics/Tags"]?.length > 0 && {
      "Topics/Tags": { multi_select: textMetadata["Topics/Tags"].map(tag => ({ name: tag })) }
    }),
    ...(textMetadata.Rating !== null && {
      Rating: { number: textMetadata.Rating }
    }),
    ...(textMetadata["Date Completed"] && {
      "Date Completed": { date: { start: textMetadata["Date Completed"] } }
    }),
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
