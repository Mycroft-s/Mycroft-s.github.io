# Hongdao Meng 的个人主页

个人主页保留原有 HTML、CSS 和 Swiper，实现中英文切换、深浅色主题、经历标签页、技能折叠和作品轮播。网站仍由 GitHub Pages 托管，域名配置位于 `CNAME`。

页面源码按栏目拆分；一个不依赖第三方包的 Node.js 脚本将模板和内容合成为五个完整静态页面：

- `index.html`：个人主页。
- `photography.html`：摄影档案。
- `project-deepfake.html`：深度伪造检测项目。
- `project-rag.html`：检索增强生成项目。
- `project-voice-agent.html`：语音 AI 智能体项目。

访客直接读取完整静态页面，不需要在浏览器中拼装栏目。摄影页按年份、设备分组展示所有照片；关闭 JavaScript 后仍可浏览缩略图并点击打开预览图。

## 本地预览

安装 Node.js 22 或更高版本。在仓库目录运行，无需执行 `npm install`：

```sh
npm run build
npm run dev
```

打开 <http://127.0.0.1:8080>，摄影页位于 <http://127.0.0.1:8080/photography.html>。修改模板、内容配置或翻译后，再运行 `npm run build` 并刷新浏览器。修改 CSS 或交互脚本后直接刷新即可。终端按 `Ctrl+C` 停止预览。

请通过本地 HTTP 服务预览，不要双击 HTML 使用 `file://` 打开；浏览器对模块脚本和翻译文件的读取有协议限制。字体和图标仍使用原有外部资源，完整显示需要联网。

## 内容应该改在哪里

| 要修改的内容 | 源文件 |
| --- | --- |
| 个人介绍、界面标签、项目及论文的中英文文案 | `assets/i18n/i18n_en.json`、`assets/i18n/i18n_cn.json` |
| 新闻日期和双语正文 | `src/data/news.json`，无需再改语言文件或 HTML |
| 工作、教育经历、机构名称、日期、徽章和 LinkedIn 链接 | `src/data/experience.json`，无需再改语言文件或 HTML |
| 摄影作品、拍摄日期、设备记录和精选标记 | `src/data/photography.json` |
| 独立摄影页的版式和界面文字 | `src/photography.html`、相关 `src/components/gallery-*.html`、中英文语言文件 |
| 摄影页年份、视图和链接状态 | `assets/js/photography.js`、`assets/js/modules/gallery-state.js` |
| 相机陈列、展映播放和照片分享 | `assets/js/modules/camera-shelf.js`、`assets/js/modules/photo-viewer.js` |
| 项目的图片、链接和文案键 | `src/data/projects.json` |
| 项目详情页的仓库、技术栈和依据链接 | `src/data/project-details.json`；双语说明使用语言文件中的 `case_*` 键 |
| 网页标题、简介、正式网址和分享封面 | `src/data/site.json`；封面图片位于 `assets/img/social-card.png` |
| 论文的图片、链接和文案键 | `src/data/publications.json` |
| 社交平台链接和图标 | `src/data/social.json` |
| 简历下载链接和按钮文字 | `src/data/resumes.json` |
| 某个栏目的排版、技能列表和技能对应作品 | `src/sections/` 中对应的 HTML |
| 导航和页脚 | `src/partials/header.html`、`src/partials/footer.html` |
| 颜色、字体、间距和响应式布局 | `assets/css/styles.css`，以及 `content-updates.css`、`controls.css`、`projects.css` 等专项样式 |
| 菜单、技能折叠、经历标签、轮播、主题和动画 | `assets/js/modules/` |
| 语言读取和切换 | `assets/js/cn-en-translate.js` |

**不要直接修改根目录的五个 HTML 页面、`sitemap.xml` 或 `robots.txt`**，它们是生成文件，下次构建会覆盖手工修改。页面结构入口位于 `src/`，项目详情页共用 `src/components/project-detail-page.html`；其他重复模板也位于 `src/components/`。

## 常见维护操作

### 修改个人介绍

同时修改两个语言 JSON 中的同名键，再运行 `npm run build`。构建时使用英文文案填入静态 HTML；访客切换中文后，浏览器读取中文配置。因此只维护语言文件，不需要再修改 HTML 中的另一份默认文字。新闻、经历和 SEO 文案直接在各自的数据文件中维护；构建会生成它们的双语映射并嵌入页面，统一使用现有语言按钮切换。

语言文件内的少量 `<br>` 和 `<a>` 是现有的受信任站点内容，用来保留换行和机构链接；不要放入未经检查的外部 HTML。

### 添加新闻

在 `src/data/news.json` 添加一条记录，日期使用 `YYYY-MM-DD`，正文分别写入 `description.en` 与 `description.cn`，然后运行构建。新闻自动按日期从新到旧排序，默认显示最新三条，访客通过“展开往期动态”查看其余记录；这个展开功能使用原生 `details`，不依赖 JavaScript，也没有栏目内部滚动条。

正文跟随当前语言单独显示。两种语言只在新闻数据中维护，不需要再把同一段话复制到语言 JSON。

### 修改工作或教育经历

`src/data/experience.json` 是经历内容的唯一来源：`organizations` 保存机构双语名称、本地徽章、LinkedIn 和可选官网链接，`work`、`education` 分别保存经历列表。两次 TikTok 经历及学校与实验室复用同一条机构记录，修改机构链接只需改一次。

每条经历包含稳定的 `id`、机构标识、双语 `title`，以及可选的 `team`、`location`、`subtitle`。日期统一写在 `periods` 数组中，`start`、`end` 使用 `YYYY-MM` 或 `YYYY-MM-DD`；仍在进行的经历将 `end` 设为 `null`。多段实习可写多个时间段，构建自动生成中英文日期。不要再把起止日期写进机构名称或副标题。

列表按配置顺序排列，通常将当前或最近经历放前面。构建会检查重复经历标识、未知机构、无效日期、结束早于开始的时间段及不安全链接。现有 C2SMARTER 经历统一为 2025 年 2 月至 12 月。时间线布局在 `src/components/experience-item.html`，校徽和公司标志来源见 `assets/img/organizations/README.md`。

### 添加摄影作品或校正元数据

照片记录集中在 `src/data/photography.json`，原图、缩略图和预览图都作为静态资源保存。常规 `npm run build` 只读取已经生成的图片，不依赖 Python，也不会每次重新压缩原图。

| 字段 | 维护约定 |
| --- | --- |
| `id` | 唯一且稳定的照片标识，使用字母、数字、连字符或下划线 |
| `src`、`thumbnail`、`preview` | 原图、列表缩略图、大图预览的本地路径；注意文件名大小写 |
| `width`、`height` | 原图经过方向校正后的正整数尺寸，用于保持照片比例 |
| `altEn`、`altCn` | 两种语言的照片描述；只写能从画面或可靠记录中确认的信息 |
| `descriptionEn`、`descriptionCn` | 卡片和大图预览显示的双语短句，与图片替代文字分开维护 |
| `year`、`yearSource` | 可靠拍摄日期的年份用 `exif`；没有可靠日期时沿用归档文件夹年份，用 `folder` |
| `capturedAt` | 可靠的 ISO 拍摄日期/时间，可保留已记录的时区；未知时为空字符串，不使用导出时间替代 |
| `cameraMake`、`cameraModel` | 可靠记录中的设备制造商、型号；未记录时为空字符串 |
| `deviceType` | `camera`、`phone`、`film` 或 `unknown`；不要根据画面风格猜测设备 |
| `deviceLabelEn`、`deviceLabelCn` | 可选的成对设备说明，例如明确指出设备记录属于胶片扫描仪 |
| `featured` | 布尔值；设为 `true` 的照片用于摄影页精选展示，也在首页按年选片时优先入选 |

年份按从新到旧排列。同一年内先按真实设备分组，设备组按数据中的首次出现顺序排列；同组有可靠拍摄日期的照片按日期从新到旧排列，无日期的照片随后保留原始顺序。文件夹年份只是归档年份，设备未知会显示“设备未记录”。已知品牌但型号未记录时保留品牌，不猜测具体型号。胶片相机标注为胶片拍摄；只有明确的设备说明才会写为扫描设备，处理软件名称也不能当作拍摄相机。

补充记录时同时准备缩略图和预览图，再运行构建。构建会拒绝重复标识、无效日期、与 EXIF 日期矛盾的年份、缺少资源或不存在的翻译。大图预览、设备筛选与年份筛选只是静态画廊之上的增强功能。

首页保留立体轮播，目前展示 12 张精选缩略图；完整摄影页仍保留全部 45 张照片。`scripts/home-data.mjs` 按年份从新到旧，每年最多选择三张（`featured` 优先，其余沿用数据顺序），首页总量最多 12 张。首页只引用现成的 WebP 缩略图，图片原生懒加载，接近摄影区域时才初始化轮播；离开区域、切换后台标签或启用减少动态效果时暂停自动播放。点击照片可直接进入档案中的对应照片。新增照片仍在同一份摄影配置维护，不需要另建首页图片列表。

摄影页的年份滑杆只在实际存在照片的年份之间切换，默认显示最新年份。设备列表始终显示全部相机；如果选择的相机在当前年份没有照片，会自动切换到全部年份，展示该相机的作品。换到新年份后，如果之前选择的设备在该年没有照片，会自动清除设备筛选。带设备参数的链接也保留该设备，必要时展开全部年份。需要所有年份总览时，可打开 `photography.html?year=all`。关闭 JavaScript 时不启用筛选，所有年份与照片仍完整可浏览。

相机陈列卡的数量始终涵盖全部年份，胶片设备带单独标记。线稿位于 `camera-shelf.js`，只表示相机类别；未知型号不会被补成具体型号。新增设备仍会自动生成卡片。

摄影页提供两种视图：原有画廊与带编号的接触印样（`?view=contact`）。两者使用同一批照片、年份和设备筛选，接触印样保留完整画面，不裁切横竖照片。“随便逛逛”在整个档案中选取照片，优先探索不同年份和设备，并避免立即重复同一张。

“展映”播放当前筛选结果，每张照片加载完成后停留 5 秒，支持暂停、方向键、触屏滑动和空格播放/暂停。浏览器允许时进入系统全屏，否则使用满窗口展映；用户偏好减少动态效果时不自动播放。切到其他标签、分享照片或关闭预览会暂停，单张照片不自动播放。

每张照片可通过 `photography.html?photo=photo-202208` 这样的稳定链接直接打开；分享按钮复制只含照片标识的链接，不携带当前年份、设备或视图筛选。剪贴板不可用时显示可选中复制的链接输入框。不要修改已发布照片的 `id`，以免旧链接失效。当前预览的照片也会同步到地址栏，刷新后仍能打开该照片。

首次添加照片或需要重新读取原图元数据时，可使用可选的图片准备工具（Python 3.10 或更新版本与 Pillow）：

```sh
python -m pip install Pillow
python scripts/photo-assets.py inspect
python scripts/photo-assets.py build
npm run build
```

`inspect` 只读统计；图片工具的 `build` 生成 WebP 缩略图、预览图并更新元数据，不修改原图。它保留双语替代文字、描述短句、精选标记和数据顺序，只采用可靠的原始拍摄日期，不采用导出或扫描时间。

人工补充设备信息请在该照片的 `deviceOverride` 对象内写入已确认的 `cameraMake`、`cameraModel`、`deviceType`，以及需要时成对提供的 `deviceLabelEn`、`deviceLabelCn`。重新准备图片时，用户确认的覆盖值优先于从文件提取的设备信息，并保留、标记为人工来源；直接修改顶层设备字段可能被下一次元数据提取覆盖。若文件只记录扫描仪或处理软件，原始信息可单独保留，不能覆盖用户确认的拍摄相机。

### 添加项目或论文

在 `src/data/projects.json` 或 `src/data/publications.json` 中参考已有记录添加图片和链接；`links` 数组把“详情、代码、论文、专利、视频、相关经历”等按钮与各自地址分开维护。为新条目使用的文案键同时补充中英文翻译。构建会检查引用的翻译和本地资源，避免发布缺少图片或文案的卡片。

三个独立项目详情页的数据位于 `src/data/project-details.json`，其中维护稳定项目标识、页面文件名、仓库地址、技术栈和可核对的源码链接。问题、贡献、流程、结果及范围说明使用语言文件中对应的 `case_*` 键；页面布局统一由 `src/components/project-detail-page.html` 生成。更新项目说明时，应同时校对证据链接和首页项目入口；技能对应作品的入口位于 `src/sections/skills.html`。

### 修改搜索与分享信息

`src/data/site.json` 集中维护站点正式域名、分享封面，以及五个页面的中英文标题和简介。构建据此生成 description、canonical、Open Graph、Twitter Card、首页人物结构化数据和站点地图；语言切换也会同步更新页面标题与简介。

分享封面是 `assets/img/social-card.png`，尺寸为 1200 × 630。新增页面时在 `site.json` 的 `pages` 中补充页面记录，并保留已发布页面的稳定路径；再运行构建，提交生成的页面、`sitemap.xml` 和 `robots.txt`。

### 更新简历

把新 PDF 放入 `assets/pdf/`，然后更新 `src/data/resumes.json` 中的链接。仅上传新 PDF 不会自动更新下载按钮。

## 检查与发布

```sh
npm run build
npm run check
npm test
```

`check` 只检查，不改写文件；如果任一页面或辅助文件的源配置已更新但输出尚未重新生成，会提示具体文件。构建先校验全部页面，再写入输出，包含跨页链接及锚点、本地图片路径大小写、中英文翻译和页面元数据。测试覆盖多页生成、过期文件检查、内容日期、首页缩略图体积预算、摄影年份/设备排序及核心交互的边界情况。本地预览还应检查手机布局、语言和主题切换、首页轮播，以及摄影页筛选、大图预览和键盘操作。

`.github/workflows/check.yml` 会在 push、pull request 或手动触发时，使用 Node.js 22 自动运行 `npm run check` 和 `npm test`。它不会自动重建并提交文件，所以应在本地先构建并提交最新输出。自动检查独立于当前 GitHub Pages 发布流程；目前没有配置检查失败就强制阻断 Pages 部署的门禁。

GitHub Pages 继续发布仓库根目录的静态文件，无需安装服务器框架或更换托管方式。发布修改时，源文件、五个最新生成的 HTML 页面、`sitemap.xml` 和 `robots.txt` 应一起提交；保留 `assets/`、`favicon.ico` 和 `CNAME`。本地构建和预览不会自动提交、推送或发布网站。

## 目录说明

```text
src/
  index.html           页面结构入口
  photography.html     独立摄影页入口
  project-*.html       三个项目详情页入口
  partials/            导航、页脚、脚本引用
  sections/            九个栏目模板
  components/          重复条目模板
  data/                新闻、经历、摄影、项目、SEO 等内容配置
assets/
  css/                 原有主题及响应式样式
  i18n/                中英文文案
  js/main.js           交互初始化入口
  js/modules/          按功能拆分的交互逻辑
  img/                 图片
  pdf/                 简历
scripts/
  build.mjs            生成并校验五个静态页面及辅助文件
  home-data.mjs        新闻、经历、首页选片及对应双语映射
  gallery-lib.mjs      摄影元数据校验、分组、排序及静态卡片
  project-data.mjs     项目按钮与详情页内容组合
  site-metadata.mjs    SEO、分享信息、sitemap.xml 与 robots.txt
  serve.mjs            仅监听本机的预览服务
tests/                 自动化检查
index.html             生成的 GitHub Pages 首页
photography.html       生成的摄影页
project-*.html         生成的三个项目详情页
sitemap.xml            生成的站点地图
robots.txt             生成的抓取说明
.github/workflows/     自动检查工作流
```

保留原模板与第三方资源的许可声明，详见 `LICENSE` 和相关资源文件头。
