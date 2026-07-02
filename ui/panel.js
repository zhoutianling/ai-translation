const elements = {
  openOptions: document.querySelector("#openOptions"),
  inputText: document.querySelector("#inputText"),
  outputText: document.querySelector("#outputText"),
  sourceLabel: document.querySelector("#sourceLabel"),
  targetLabel: document.querySelector("#targetLabel"),
  translateNow: document.querySelector("#translateNow"),
  clearText: document.querySelector("#clearText"),
  copyOutput: document.querySelector("#copyOutput"),
  clearData: document.querySelector("#clearData"),
  statusDot: document.querySelector("#statusDot"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText")
};

const AUTO_TRANSLATE_DELAY_MS = 650;

let currentSettings = null;
let debounceId = 0;
let activeRequestId = 0;
let lastTranslatedText = "";

document.addEventListener("DOMContentLoaded", init);
elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.inputText.addEventListener("input", scheduleTranslation);
elements.translateNow.addEventListener("click", () => translateCurrentText(true));
elements.clearText.addEventListener("click", clearText);
elements.copyOutput.addEventListener("click", copyOutput);
elements.clearData.addEventListener("click", clearPersonalData);

async function init() {
  setBusy(true);

  try {
    currentSettings = await request({ type: "GET_PUBLIC_SETTINGS" });
    updateDirectionLabels("");

    if (!currentSettings.hasApiKey) {
      showStatus("需要配置 API Key", "打开设置页填写 API Key、Base URL 和模型后即可翻译。", "bad");
      return;
    }

    showStatus("准备就绪", "输入中文自动译英文，输入英文自动译中文。", "good");
  } catch (error) {
    showStatus("无法读取设置", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function scheduleTranslation() {
  const text = elements.inputText.value.trim();
  window.clearTimeout(debounceId);
  updateDirectionLabels(text);

  if (!text) {
    elements.outputText.value = "";
    lastTranslatedText = "";
    showStatus("准备就绪", "输入中文或英文后会自动翻译。", "good");
    return;
  }

  showStatus("等待输入完成", "稍停一下就会自动翻译。", "");
  debounceId = window.setTimeout(() => translateCurrentText(false), AUTO_TRANSLATE_DELAY_MS);
}

async function translateCurrentText(isManual) {
  const text = elements.inputText.value.trim();

  window.clearTimeout(debounceId);
  updateDirectionLabels(text);

  if (!text) {
    elements.outputText.value = "";
    lastTranslatedText = "";
    showStatus("准备就绪", "输入中文或英文后会自动翻译。", "good");
    return;
  }

  if (!currentSettings?.hasApiKey) {
    chrome.runtime.openOptionsPage();
    showStatus("需要配置 API Key", "设置完成并测试通过后，再回来输入文本翻译。", "bad");
    return;
  }

  if (!isManual && text === lastTranslatedText) {
    return;
  }

  const requestId = activeRequestId + 1;
  activeRequestId = requestId;
  setBusy(true);
  showStatus("正在翻译", "正在调用你配置的模型生成译文。", "");

  try {
    const result = await translateText(text);

    if (requestId !== activeRequestId) {
      return;
    }

    elements.outputText.value = result.translation || "";
    lastTranslatedText = text;
    updateDirectionLabels(text, result);
    showStatus("翻译完成", "可以继续输入，译文会自动更新。", "good");
  } catch (error) {
    if (requestId === activeRequestId) {
      showStatus("翻译失败", error.message, "bad");
    }
  } finally {
    if (requestId === activeRequestId) {
      setBusy(false);
    }
  }
}

function clearText() {
  window.clearTimeout(debounceId);
  activeRequestId += 1;
  elements.inputText.value = "";
  elements.outputText.value = "";
  lastTranslatedText = "";
  updateDirectionLabels("");
  showStatus("已清空", "输入中文或英文后会自动翻译。", "good");
}

async function translateText(text) {
  try {
    return await request({
      type: "TRANSLATE_TEXT",
      payload: { text }
    });
  } catch (error) {
    if (!isUnknownRequestError(error)) {
      throw error;
    }

    return translateTextDirectly(text);
  }
}

function isUnknownRequestError(error) {
  const message = String(error?.message || "");
  return message.includes("未知请求") || message.includes("Unknown request") || message.includes("鏈煡");
}

async function translateTextDirectly(text) {
  const settings = await request({ type: "GET_PRIVATE_SETTINGS" });

  if (!settings.apiKey) {
    throw new Error("请先在设置页填写 API Key。");
  }

  const targetLanguage = hasChineseText(text) ? "en" : "zh-Hans";
  const sourceName = targetLanguage === "en" ? "Chinese" : "English";
  const targetName = targetLanguage === "en" ? "English" : "Simplified Chinese";
  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o-mini",
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

  return {
    translation: cleanupTextTranslation(getAssistantContent(result)),
    sourceLanguage: sourceName,
    targetLanguage: targetName
  };
}

function hasChineseText(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value || "https://ai.yun.dev/v1").trim().replace(/\/+$/, "");
  const url = new URL(baseUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("接口地址必须以 http:// 或 https:// 开头。");
  }

  return url.toString().replace(/\/+$/, "");
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

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

async function copyOutput() {
  const text = elements.outputText.value.trim();

  if (!text) {
    showStatus("没有译文", "翻译完成后再复制。", "bad");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showStatus("已复制", "译文已复制到剪贴板。", "good");
  } catch (error) {
    showStatus("复制失败", error.message, "bad");
  }
}

async function clearPersonalData() {
  if (!window.confirm("确定清除已保存的 API Key 并关闭自动翻译吗？")) {
    return;
  }

  setBusy(true);

  try {
    currentSettings = await request({ type: "CLEAR_PERSONAL_DATA" });
    showStatus("账号数据已清除", "已删除本机保存的 API Key。", "good");
  } catch (error) {
    showStatus("清除失败", error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function updateDirectionLabels(text, result = null) {
  if (result?.sourceLanguage && result?.targetLanguage) {
    elements.sourceLabel.textContent = result.sourceLanguage === "Chinese" ? "中文" : "English";
    elements.targetLabel.textContent = result.targetLanguage === "English" ? "English" : "中文";
    return;
  }

  if (!text) {
    elements.sourceLabel.textContent = "自动检测";
    elements.targetLabel.textContent = "中文 / English";
    return;
  }

  const hasChinese = /[\u3400-\u9fff]/.test(text);
  elements.sourceLabel.textContent = hasChinese ? "中文" : "English";
  elements.targetLabel.textContent = hasChinese ? "English" : "中文";
}

function showStatus(title, text, mood) {
  elements.statusTitle.textContent = title;
  elements.statusText.textContent = text;
  elements.statusDot.classList.toggle("good", mood === "good");
  elements.statusDot.classList.toggle("bad", mood === "bad");
}

function setBusy(isBusy) {
  elements.translateNow.disabled = isBusy;
  elements.copyOutput.disabled = isBusy;
}

function request(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "扩展后台没有响应。"));
        return;
      }

      resolve(response.data);
    });
  });
}
