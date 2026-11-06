# dsh-plugin-question-attachments

中文 | [English](README.md)

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里，**回答 `ask_user_question` 提问卡片时也能发图片和文件**。

> 状态：**alpha / 最小可用版**。在 DSH `0.2.2-rc.1`（Windows 桌面端）上验证。

## 问题

`ask_user_question` 会用一张回答卡片接管输入框位置，而回答的结构只有文本：

```ts
{ selected: string[], custom?: string }
```

DSH 里的附件是 **prompt 凭证**：由 `ctx.fileUpload` 上传暂存，只在**用户消息**准入时被消费。工具回答没有承载附件的通道，所以卡片挂着的时候没法把截图塞进答案。

## 这个插件做了什么

当当前会话存在 pending 交互（提问卡片占据输入框）时：

1. 作答输入行右端出现一个小按钮：**📎**（卡片内部）；
2. 点选、`Ctrl+V` 粘贴、或把文件拖到按钮上；
3. 插件调用 `ctx.fileUpload.uploadImage()` / `upload()` 上传，拿到 receipt；
4. 以 **steering prompt** 的形式发给 Agent：
   `session.prompt([{ type: 'file', receiptId }, { type: 'text', text }], 'steer')`；
5. 每个已发送文件显示为作答行上方的一张卡片（缩略图、文件名、类型，最多三张，其余 `+N`）。

阻塞提问期间会话仍是 `running`，steer 会被 Inbox 收下排队；Host 只会在当前工具等待结束后准入——也就是**模型在下一步同时看到答案和附件**。

不改协议、不修改安装包，随时可卸。

## 安装

这是一个普通的 DSH bundle 包，带一个 web 客户端半边。

### 在 DSH 界面里装（最省事）

侧栏 → **插件** → **添加插件**，填入仓库地址：

```
https://github.com/rxdage/dsh-plugin-question-attachments
```

然后 **安装** → **立即启用** → 重启 DeepSeek Harness。对话框也接受
`github:rxdage/dsh-plugin-question-attachments`、压缩包地址或本地绝对路径。

### 用 CLI 装

```bash
dsh plugin --profile desktop add github:rxdage/dsh-plugin-question-attachments
```

### 手动（链接一份 checkout）

```powershell
git clone https://github.com/rxdage/dsh-plugin-question-attachments "$env:LOCALAPPDATA\dsh-plugin-question-attachments"

$profile = "$env:USERPROFILE\.dsh\profiles\desktop"
New-Item -ItemType Junction -Path "$profile\node_modules\dsh-plugin-question-attachments" `
  -Target "$env:LOCALAPPDATA\dsh-plugin-question-attachments"
```

然后在 `profiles/desktop/package.json` 里登记：

```jsonc
{
  "dependencies": {
    "dsh-plugin-question-attachments": "link:C:/Users/<you>/AppData/Local/dsh-plugin-question-attachments"
  },
  "dsh": { "profile": { "bundles": [ /* ..., */ "dsh-plugin-question-attachments" ] } }
}
```

重启 DeepSeek Harness。卸载：删掉 junction 和这两处条目（或在 **插件** 页里卸载）。
## 用法

让 Agent 触发一次 `ask_user_question`，卡片出现时：

- 点作答输入行右端的 **📎** 按钮；或
- 直接粘贴剪贴板里的截图；或
- 把文件拖到按钮上。

按钮上会显示上传进度和失败原因。附件作为待处理用户消息排队，你作答后 Agent 在下一步同时拿到答案和附件。

## 限制

- 只在提问/审批卡片挂起时出现；卡片隐藏后 `pendingInteraction` 清空，按钮随之消失。
- 工具等待期间的 steer 是排队而非立即送达——这是 Host 的既定行为。
- 目前一次一个文件，没有拖拽排序和预览。
- 示例只接了 desktop profile；任何带 `fileUpload` + `sessions` 客户端服务的 profile 都能用。

## 兼容性

在 DSH `0.2.2-rc.1` 上构建并验证。只使用公开的客户端服务（`slots`、`sessions`、`uiSession`、`fileUpload`、`session.prompt`），没有私有 API；但客户端 bundle 格式尚未 1.0，升级后请留意 [CHANGELOG](CHANGELOG.md)。

## 许可证

MIT
