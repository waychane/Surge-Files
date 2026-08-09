# AI Usage Panel for Surge

这是一个不包含任何服务密钥的 Surge AI 用量面板脚本。

目录内容：

- ai-usage-panel.js：Surge generic Panel 脚本，只负责请求并格式化统一 JSON。
- ai-usage-panel.sgmodule：可选模块，只安装 Script；Surge 的 [Panel] 入口仍需按下方说明加入主配置。
- README.md：数据接口约定和安装说明。

## 设计边界

面板不直接登录或抓取 Codex、ChatGPT、Gemini、Claude、Grok 等网页账户，也不保存 Cookie、OAuth Token 或 API Key。

推荐的链路是：

    Surge Panel -> 受保护的统一 JSON 接口 -> 各服务官方 usage / quota 接口

统一接口只需要返回已经整理好的用量摘要，不应返回 prompt、response、Cookie 或原始认证信息。

## JSON 接口约定

接口应返回一个 JSON 对象，services 可以是数组，也可以是以服务 ID 为键的对象：

    {
      "updated_at": "2026-08-09T12:00:00Z",
      "services": [
        {
          "id": "codex",
          "name": "Codex",
          "status": "ok",
          "used": 42,
          "limit": 100,
          "remaining": 58,
          "unit": "credits",
          "reset_at": "2026-08-10T00:00:00Z"
        },
        {
          "id": "gemini",
          "name": "Gemini",
          "status": "ok",
          "percent": 31,
          "unit": "quota",
          "note": "project: default"
        },
        {
          "id": "claude",
          "name": "Claude",
          "status": "unavailable",
          "note": "usage source not configured"
        }
      ]
    }

支持的 status：

- ok / ready：正常显示。
- not_configured：尚未配置数据源，面板显示 info。
- unavailable / error：数据源暂时不可用，面板显示 alert。

used、limit、remaining、percent 都是可选字段。不同服务的单位可以不同，例如 credits、tokens、requests、messages 或 quota。

## Surge 配置

### 方式一：安装模块

安装以下模块 URL：

    https://raw.githubusercontent.com/waychane/Surge-Files/main/Modules/AI-Usage/ai-usage-panel.sgmodule

安装模块后，在主配置中加入：

    [Panel]
    AIUsage = title="AI 用量",content="正在读取…",style=info,script-name=ai-usage,update-interval=300

模块只负责安装 Script；当前 Surge 模块文档没有把 [Panel] 列为可覆盖区域，因此保留这一行在主配置中更稳妥。

### 方式二：手动加入

    [Panel]
    AIUsage = title="AI 用量",content="正在读取…",style=info,script-name=ai-usage,update-interval=300

    [Script]
    ai-usage = type=generic,script-path=https://raw.githubusercontent.com/waychane/Surge-Files/main/Modules/AI-Usage/ai-usage-panel.js,script-update-interval=86400,argument=endpoint=https%3A%2F%2Fyour-private-endpoint.example%2Fai-usage.json

Script argument 也可以直接写成接口 URL。脚本还支持：

    endpoint=https%3A%2F%2Fyour-private-endpoint.example%2Fai-usage.json&token=LOCAL_ONLY

token 只应放在本机私有配置或本地覆盖中，绝不能提交到这个公开仓库、共享配置或截图中。更推荐让统一接口自行使用网络访问控制或短期凭据。

## 发布和更新建议

- GitHub 仓库只放脚本、模块和文档，不放真实用量 JSON、账号信息或认证材料。
- 生产配置可以把 script-path 固定到 tag 或 commit，而不是长期跟随 main。
- script-update-interval 建议保持较长；面板的 update-interval 再按需刷新数据。
- 后端接口应返回简化数据，并在 updated_at 中标明数据时间。
