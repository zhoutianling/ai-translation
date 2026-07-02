const DEFAULT_SETTINGS = Object.freeze({
  apiKey: "",
  baseUrl: "https://ai.yun.dev/v1",
  model: "gpt-4o-mini"
});

chrome.runtime.onInstalled.addListener(() => {
  setupSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  setupSidePanelBehavior();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: safeError(error) }));

  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_PUBLIC_SETTINGS":
      return getPublicSettings();

    case "GET_PRIVATE_SETTINGS":
      return getPrivateSettings();

    case "SAVE_SETTINGS":
      return saveSettings(message.settings || {});

    case "CLEAR_PERSONAL_DATA":
      return clearPersonalData();

    case "TRANSLATE_TEXT":
      return translateText(message.payload || {});

    case "TEST_TRANSLATION":
      return testTranslation();

    case "FETCH_MODELS":
      return fetchModels(message.settings || {});

    default:
      throw new Error("未知请求。");
  }
}

function setupSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      // Older Edge/Chromium builds can still use the popup fallback.
    });
}

async function getPrivateSettings() {
  const settings = await storageGet(DEFAULT_SETTINGS);
  return {
    ...settings,
    hasApiKey: Boolean(settings.apiKey)
  };
}

async function getPublicSettings() {
  const settings = await getPrivateSettings();
  const { apiKey, ...publicSettings } = settings;
  return publicSettings;
}

async function saveSettings(nextSettings) {
  const current = await getPrivateSettings();
  const normalized = normalizeSettings(nextSettings, current);
  await storageSet(normalized);
  return getPublicSettings();
}

async function clearPersonalData() {
  await storageSet({
    apiKey: ""
  });

  return getPublicSettings();
}

function normalizeSettings(input, current) {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(input, "apiKey")) {
    normalized.apiKey = String(input.apiKey || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "baseUrl")) {
    normalized.baseUrl = normalizeBaseUrl(input.baseUrl, current.baseUrl);
  }

  if (Object.prototype.hasOwnProperty.call(input, "model")) {
    normalized.model = String(input.model || current.model || DEFAULT_SETTINGS.model).trim();
  }

  return normalized;
}

function normalizeBaseUrl(value, fallback) {
  const baseUrl = String(value || fallback || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, "");
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("接口地址必须以 http:// 或 https:// 开头。");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("Base URL 格式不正确。");
  }
}

async function testTranslation() {
  const result = await translateText({
    text: "Hello, this sentence can now be translated."
  });

  return {
    sample: result.translation || ""
  };
}

async function translateText(payload) {
  const settings = await getPrivateSettings();

  if (!settings.apiKey) {
    throw new Error("请先在设置页填写 API Key。");
  }

  const text = String(payload.text || "").trim();
  if (!text) {
    return {
      translation: "",
      sourceLanguage: "auto",
      targetLanguage: "auto"
    };
  }

  const targetLanguage = detectChineseText(text) ? "en" : "zh-Hans";
  const targetName = targetLanguage === "en" ? "English" : "Simplified Chinese";
  const sourceName = targetLanguage === "en" ? "Chinese" : "English";
  const endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a precise Chinese-English translation engine. Translate the user's text only. Preserve meaning, numbers, names, URLs, markdown, and line breaks. Return only the translated text without explanations."
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceLanguage: sourceName,
            targetLanguage: targetName,
            text
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`接口返回 ${response.status}: ${truncate(errorText, 240)}`);
  }

  const result = await response.json();
  const content = getAssistantContent(result);

  return {
    translation: cleanupTextTranslation(content),
    sourceLanguage: sourceName,
    targetLanguage: targetName
  };
}

function detectChineseText(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function cleanupTextTranslation(content) {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```(?:text|json|markdown)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "string") {
      return parsed.trim();
    }
    if (typeof parsed?.translation === "string") {
      return parsed.translation.trim();
    }
    if (typeof parsed?.text === "string") {
      return parsed.text.trim();
    }
  } catch {
    // Plain translated text is the expected response.
  }

  return cleaned;
}

async function fetchModels(input) {
  const current = await getPrivateSettings();
  const apiKey = String(input.apiKey || current.apiKey || "").trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl || current.baseUrl, current.baseUrl);

  if (!apiKey) {
    throw new Error("请先填写 API Key。");
  }

  const response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`模型列表获取失败 ${response.status}: ${truncate(errorText, 240)}`);
  }

  const result = await response.json();
  const models = normalizeModelList(result);

  if (!models.length) {
    throw new Error("接口没有返回可用模型。");
  }

  return { models };
}

function normalizeModelList(result) {
  const rawItems = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.models)
        ? result.models
        : [];

  return rawItems
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      return item?.id || item?.name || item?.model || "";
    })
    .map((model) => String(model).trim())
    .filter(Boolean)
    .filter((model, index, list) => list.indexOf(model) === index)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 200);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getAssistantContent(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || part?.content || "";
      })
      .join("");
  }

  if (typeof result?.output_text === "string") {
    return result.output_text;
  }

  throw new Error("接口响应中没有找到翻译结果。");
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items || {}));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function safeError(error) {
  if (error?.name === "AbortError") {
    return "请求超时，请稍后重试。";
  }
  return error?.message || String(error || "未知错误");
}
