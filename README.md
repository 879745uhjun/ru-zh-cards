# 俄汉记忆卡 · Beta v1.3

离线可用的俄汉对照记忆卡。按“书 → 单元 → 卡片”组织，逐词标重音和语法，并支持查原课文/对话来源。

## 打开方式

双击 \`index.html\`，默认进入“新东方大学俄语（3）”书首页。不需要安装依赖，也不需要联网。

## 页面

| 页面 | 作用 |
|---|---|
| \`index.html\` | 卡片学习模式 |
| \`book.html\` | 书首页 / 单元目录 |
| \`unit.html\` | 整课浏览 |
| \`plan.html\` | 学习计划：顺序 / 复习 / 自定义 |
| \`sources.html\` | 全局来源查询 |
| \`changelog.html\` | 更新日志 |

## 当前内容

- 5 个单元，226 张卡
- 第 1 课 57 张
- 第 2 课 27 张
- 第 3 课 51 张
- 第 4 课 50 张
- 第 5 课 41 张

## 功能

- 三种对照模式：对照 / 俄 → 汉 / 汉 → 俄
- 学习模式：点击单词才显示该词语法
- 卡片固定高度，翻页不跳动
- 编辑权限开关，默认关闭
- 顶部固定快捷栏：上一级、上一页、下一页、书首页、整课、计划、来源、日志、编辑
- 学习进度：已掌握 / 需复习、今日复习、错题本、轻量间隔复习
- 分类筛选、搜索、随机、页码跳转、键盘翻页
- 导入、导出、完整备份/恢复、多课程管理
- 书首页 / 单元页 / 卡片模式共用同一份本地课程数据

## 来源

- 卡片右上角“来源”
- 全局来源查询页
- 显示：书名、课次、第几个对话/课文、页码、原句
- 附“查看原 PDF · 第 N 页”
- 对话/全文为 OCR 初稿，可展开查看
- 来源跟卡片一起保存、导出、备份

原 PDF 在 \`sources/\`：

- \`lesson1.pdf\`
- \`lesson2.pdf\`
- \`lesson3.pdf\`
- \`lesson4.pdf\`
- \`lesson5.pdf\`

## 目录

\`\`\`text
ru-zh-cards/
├─ index.html
├─ book.html
├─ unit.html / unit.css / unit.js
├─ plan.html / plan.css / plan.js
├─ sources.html / sources.css / sources.js
├─ changelog.html / changelog.css
├─ sidebar.css / sidebar.js
├─ styles.css / app.js
├─ data/
│  ├─ deck.js
│  ├─ lesson1.js
│  ├─ lesson2.js
│  ├─ lesson3.js
│  ├─ lesson5.js
│  ├─ decks-source.js
│  └─ sources.js
└─ sources/
   └─ lesson1–5.pdf
\`\`\`

## 导入格式

表格每行一张卡，用 Tab 分隔：

\`\`\`text
俄语	中文	逐词语法（可选）
\`\`\`

- 重音用方括号，例如 \`чит[а]ет\`；\`ё\` 自动视为重音。
- 语法用 \`|\` 分隔不同单词，用 \`/\` 分隔同一个词的多个标签。
- 语法数量应与俄语单词数量一致。

JSON 支持 \`cards\`、\`ru\`、\`zh\`、\`tag\`、\`note\`、\`grammar\`，也支持显式 \`words\`。

## 已知限制

- 来源全文是 OCR 初稿，仍有少量错字；原 PDF 可核对。
- 226 张卡中已有 162 张匹配来源，其余 64 张暂无来源。
- 间隔复习是轻量版：已掌握 +7 天、需复习当天。
- 搜索不包含语法提示正文。
- 数据保存在当前浏览器 localStorage；换浏览器或清数据会回到内置内容。
- 还没有账号/云同步。

## 版本

当前 **Beta v1.3**。更新记录见 `changelog.html`。
