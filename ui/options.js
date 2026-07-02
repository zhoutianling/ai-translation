const form = document.querySelector("#settingsForm");
const fields = {
  apiKey: document.querySelector("#apiKey"),
  baseUrl: document.querySelector("#baseUrl"),
  model: document.querySelector("#model")
};
const notice = document.querySelector("#notice");
const saveAndTest = document.querySelector("#saveAndTest");
const clearData = document.querySelector("#clearData");
const fetchModelsButton = document.querySelector("#fetchModels");

let hasSavedApiKey = false;

document.addEventListener("DOMContentLoaded", loadSettings);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(false);
});
saveAndTest.addEventListener("click", () => saveSettings(true));
clearData.addEventListener("click", clearPersonalData);
fetchModelsButton.addEventListener("click", fetchModels);

async function loadSettings() {
  try {
    const settings = await request({ type: "GET_PRIVATE_SETTINGS" });
    hasSavedApiKey = Boolean(settings.hasApiKey);

    fields.baseUrl.value = settings.baseUrl || "https://ai.yun.dev/v1";
    setModelValue(settings.model || "gpt-4o-mini");
    fields.apiKey.placeholder = hasSavedApiKey
      ? "已保存 API Key；留空则不修改"
      : "粘贴你的 API Key";

    showNotice(hasSavedApiKey ? "设置已读取。" : "请先填写 API Key。", hasSavedApiKey ? "good" : "");
  } catch (error) {
    showNotice(error.message, "bad");
  }
}

async function saveSettings(shouldTest) {
  setBusy(true);

  try {
    const settings = await request({
      type: "SAVE_SETTINGS",
      settings: readFormPayload()
    });

    hasSavedApiKey = Boolean(settings.hasApiKey);
    fields.apiKey.value = "";
    fields.apiKey.placeholder = hasSavedApiKey
      ? "已保存 API Key；留空则不修改"
      : "粘贴你的 API Key";

    if (shouldTest) {
      showNotice("正在测试翻译接口...", "");
      const result = await request({ type: "TEST_TRANSLATION" });
      showNotice(`测试通过：${result.sample}`, "good");
    } else {
      showNotice("设置已保存。", "good");
    }
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function fetchModels() {
  const apiKey = fields.apiKey.value.trim();

  if (!apiKey && !hasSavedApiKey) {
    showNotice("请先填写 API Key。", "bad");
    return;
  }

  setBusy(true);

  try {
    showNotice("正在获取模型列表...", "");

    const result = apiKey
      ? await fetchModelsFromCurrentInput(apiKey)
      : await request({
        type: "FETCH_MODELS",
        settings: {
          baseUrl: fields.baseUrl.value.trim()
        }
      });
    const models = Array.isArray(result.models) ? result.models : [];

    renderModelOptions(models);
    showNotice(`已获取 ${models.length} 个模型，可在模型下拉框中选择。`, "good");
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

async function fetchModelsFromCurrentInput(apiKey) {
  try {
    return await fetchModelsFromApi(apiKey, fields.baseUrl.value.trim());
  } catch (directError) {
    try {
      return await request({
        type: "FETCH_MODELS",
        settings: {
          apiKey,
          baseUrl: fields.baseUrl.value.trim()
        }
      });
    } catch (backgroundError) {
      throw new Error(`${directError.message}；后台请求也失败：${backgroundError.message}`);
    }
  }
}

async function fetchModelsFromApi(apiKey, baseUrl) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
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

function normalizeBaseUrl(value) {
  const baseUrl = String(value || "https://ai.yun.dev/v1").trim().replace(/\/+$/, "");
  const url = new URL(baseUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("接口地址必须以 http:// 或 https:// 开头。");
  }

  return url.toString().replace(/\/+$/, "");
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

function renderModelOptions(models) {
  const currentModel = fields.model.value.trim();
  fields.model.textContent = "";

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    fields.model.appendChild(option);
  }

  if (!models.length) {
    setModelValue(currentModel || "gpt-4o-mini");
    return;
  }

  fields.model.value = models.includes(currentModel) ? currentModel : models[0];
}

function setModelValue(model) {
  const value = String(model || "gpt-4o-mini").trim();
  const existingOption = Array.from(fields.model.options).find((option) => option.value === value);

  if (!existingOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fields.model.appendChild(option);
  }

  fields.model.value = value;
}

function readFormPayload() {
  const payload = {
    baseUrl: fields.baseUrl.value.trim(),
    model: fields.model.value.trim()
  };

  const nextApiKey = fields.apiKey.value.trim();
  if (nextApiKey) {
    payload.apiKey = nextApiKey;
  }

  return payload;
}

async function clearPersonalData() {
  if (!window.confirm("确定清除已保存的 API Key 吗？")) {
    return;
  }

  setBusy(true);

  try {
    await request({ type: "CLEAR_PERSONAL_DATA" });
    hasSavedApiKey = false;
    fields.apiKey.value = "";
    fields.apiKey.placeholder = "粘贴你的 API Key";
    showNotice("账号数据已清除。", "good");
  } catch (error) {
    showNotice(error.message, "bad");
  } finally {
    setBusy(false);
  }
}

function showNotice(message, mood) {
  notice.textContent = message;
  notice.classList.toggle("good", mood === "good");
  notice.classList.toggle("bad", mood === "bad");
}

function setBusy(isBusy) {
  for (const field of Object.values(fields)) {
    field.disabled = isBusy;
  }

  saveAndTest.disabled = isBusy;
  clearData.disabled = isBusy;
  fetchModelsButton.disabled = isBusy;
}

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
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
