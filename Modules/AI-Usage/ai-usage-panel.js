/*
 * AI Usage Panel for Surge
 *
 * This script only formats a normalized JSON response. It does not contain
 * provider credentials and it does not scrape any provider's web session.
 *
 * $argument formats:
 *   endpoint=https%3A%2F%2Fexample.com%2Fai-usage.json
 *   endpoint=https%3A%2F%2Fexample.com%2Fai-usage.json&token=LOCAL_ONLY
 */

(function () {
  var DEFAULT_ENDPOINT = "https://example.invalid/ai-usage.json";

  function finish(title, content, style) {
    $done({
      title: title,
      content: content,
      style: style
    });
  }

  function safeText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).replace(/[\r\n]+/g, " ").trim();
  }

  function decode(value) {
    try {
      return decodeURIComponent(String(value).replace(/\+/g, " "));
    } catch (e) {
      return String(value);
    }
  }

  function parseArgument(raw) {
    var config = {};
    raw = safeText(raw);

    if (!raw) {
      return config;
    }

    if (raw.charAt(0) === "{") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return config;
      }
    }

    if (raw.indexOf("endpoint=") === 0 || raw.indexOf("&") >= 0) {
      var pairs = raw.split("&");
      for (var i = 0; i < pairs.length; i++) {
        var separator = pairs[i].indexOf("=");
        if (separator < 0) {
          continue;
        }

        var key = pairs[i].slice(0, separator);
        var value = decode(pairs[i].slice(separator + 1));

        if (key === "endpoint" || key === "url") {
          config.endpoint = value;
        } else if (key === "token") {
          config.token = value;
        }
      }
    } else {
      config.endpoint = raw;
    }

    return config;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    var number = typeof value === "number" ? value : parseFloat(value);
    return isFinite(number) ? number : null;
  }

  function formatNumber(value) {
    var number = numberOrNull(value);
    if (number === null) {
      return "—";
    }

    if (Math.abs(number) >= 1000000) {
      return (number / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
    }

    if (Math.abs(number) >= 1000) {
      return (number / 1000).toFixed(2).replace(/\.?0+$/, "") + "K";
    }

    return number % 1 === 0 ? String(number) : number.toFixed(2).replace(/\.?0+$/, "");
  }

  function usagePercent(item) {
    var explicit = numberOrNull(item.percent);
    if (explicit !== null) {
      return Math.max(0, Math.min(100, explicit));
    }

    var used = numberOrNull(item.used);
    var limit = numberOrNull(item.limit);
    if (used !== null && limit !== null && limit > 0) {
      return Math.max(0, Math.min(100, used / limit * 100));
    }

    var remaining = numberOrNull(item.remaining);
    if (remaining !== null && limit !== null && limit > 0) {
      return Math.max(0, Math.min(100, (limit - remaining) / limit * 100));
    }

    return null;
  }

  function formatTime(value) {
    return safeText(value)
      .replace("T", " ")
      .replace(/\.\d+Z$/, "Z");
  }

  function copyItem(item, fallbackId) {
    var copy = {};
    for (var key in item) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        copy[key] = item[key];
      }
    }
    copy.id = copy.id || fallbackId;
    return copy;
  }

  function normalizeServices(payload) {
    var services = payload && payload.services;
    var result = [];

    if (Array.isArray(services)) {
      for (var i = 0; i < services.length; i++) {
        if (services[i] && typeof services[i] === "object") {
          result.push(copyItem(services[i], "service-" + i));
        }
      }
      return result;
    }

    if (services && typeof services === "object") {
      for (var id in services) {
        if (Object.prototype.hasOwnProperty.call(services, id) &&
            services[id] && typeof services[id] === "object") {
          result.push(copyItem(services[id], id));
        }
      }
    }

    return result;
  }

  function serviceLine(item) {
    var label = safeText(item.name || item.label || item.id || "Unknown");
    var status = safeText(item.status || "ok").toLowerCase();
    var parts = [];

    if (label.length > 40) {
      label = label.slice(0, 40);
    }

    if (status !== "ok" && status !== "ready") {
      parts.push(safeText(item.note || item.message || status || "unavailable"));
      return label + "  " + parts.join(" · ");
    }

    var percent = usagePercent(item);
    if (percent !== null) {
      parts.push(formatNumber(percent) + "%");
    }

    var used = numberOrNull(item.used);
    var limit = numberOrNull(item.limit);
    var remaining = numberOrNull(item.remaining);
    var unit = safeText(item.unit);

    if (used !== null && limit !== null) {
      parts.push(formatNumber(used) + "/" + formatNumber(limit) + (unit ? " " + unit : ""));
    } else if (remaining !== null && limit !== null) {
      parts.push("剩余 " + formatNumber(remaining) + "/" + formatNumber(limit) + (unit ? " " + unit : ""));
    } else if (item.value !== null && item.value !== undefined) {
      parts.push(safeText(item.value) + (unit ? " " + unit : ""));
    }

    if (item.reset_at || item.resetAt) {
      parts.push("重置 " + formatTime(item.reset_at || item.resetAt));
    }

    if (item.note) {
      parts.push(safeText(item.note));
    }

    return label + "  " + (parts.length ? parts.join(" · ") : "暂无数据");
  }

  function panelStyle(items) {
    var hasError = false;
    var hasWarning = false;
    var configured = false;

    for (var i = 0; i < items.length; i++) {
      var status = safeText(items[i].status || "ok").toLowerCase();
      if (status === "ok" || status === "ready") {
        configured = true;
      } else if (status === "not_configured") {
        hasWarning = true;
      } else {
        hasError = true;
      }

      var percent = usagePercent(items[i]);
      if (percent !== null && percent >= 90) {
        hasWarning = true;
      }
    }

    if (hasError) {
      return "alert";
    }
    if (hasWarning || !configured) {
      return "info";
    }
    return "good";
  }

  var config = parseArgument(typeof $argument === "undefined" ? "" : $argument);
  var endpoint = safeText(config.endpoint || DEFAULT_ENDPOINT);

  if (!endpoint || endpoint === DEFAULT_ENDPOINT) {
    finish("AI 用量", "未配置数据接口\n请在 Script argument 中设置 endpoint。", "info");
    return;
  }

  var request = {
    url: endpoint,
    headers: {
      Accept: "application/json"
    }
  };

  if (config.token) {
    request.headers.Authorization = "Bearer " + config.token;
  }

  $httpClient.get(request, function (error, response, body) {
    if (error) {
      finish("AI 用量", "接口请求失败\n" + safeText(error), "alert");
      return;
    }

    var statusCode = response && Number(response.status);
    if (!statusCode || statusCode < 200 || statusCode >= 300) {
      finish("AI 用量", "接口返回 HTTP " + (statusCode || "unknown"), "alert");
      return;
    }

    var payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      finish("AI 用量", "接口返回的不是有效 JSON", "alert");
      return;
    }

    var items = normalizeServices(payload);
    if (!items.length) {
      finish("AI 用量", "接口没有返回 services 数据", "alert");
      return;
    }

    var lines = [];
    for (var i = 0; i < items.length; i++) {
      lines.push(serviceLine(items[i]));
    }

    if (payload.updated_at || payload.updatedAt) {
      lines.push("");
      lines.push("更新 " + formatTime(payload.updated_at || payload.updatedAt));
    }

    finish("AI 用量", lines.join("\n"), panelStyle(items));
  });
})();
