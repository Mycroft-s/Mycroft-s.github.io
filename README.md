# Hongdao Meng 的个人主页

个人主页保留原有 HTML、CSS 和 Swiper，实现中英文切换、深浅色主题、经历标签页、技能折叠和作品轮播。网站仍由 GitHub Pages 托管，域名配置位于 `CNAME`。

页面源码按栏目拆分；一个不依赖第三方包的 Node.js 脚本将模板和内容合成为根目录的 `index.html` 和独立摄影页 `photography.html`。访客直接读取完整静态页面，不需要在浏览器中拼装栏目。摄影页按年份、设备分组展示所有照片；关闭 JavaScript 后仍可浏览缩略图并点击打开预览图。

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
| 个人介绍、栏目标题、项目及论文的中英文文案 | `assets/i18n/i18n_en.json`、`assets/i18n/i18n_cn.json` |
| 新闻及日期 | `src/data/news.json` |
| 摄影作品、拍摄日期、设备记录和精选标记 | `src/data/photography.json` |
| 独立摄影页的版式和界面文字 | `src/photography.html`、相关 `src/components/gallery-*.html`、中英文语言文件 |
| 摄影页筛选、预览大图和键盘切换 | `assets/js/photography.js` |
| 项目的图片、链接和文案键 | `src/data/projects.json` |
| 论文的图片、链接和文案键 | `src/data/publications.json` |
| 社交平台链接和图标 | `src/data/social.json` |
| 简历下载链接和按钮文字 | `src/data/resumes.json` |
| 某个栏目的排版、技能列表、经历日期 | `src/sections/` 中对应的 HTML |
| 导航和页脚 | `src/partials/header.html`、`src/partials/footer.html` |
| 颜色、字体、间距和响应式布局 | `assets/css/styles.css` |
| 菜单、技能折叠、经历标签、轮播、主题和动画 | `assets/js/modules/` |
| 语言读取和切换 | `assets/js/cn-en-translate.js` |

**不要直接修改根目录的 `index.html` 或 `photography.html`**，它们是生成文件，下次构建会覆盖手工修改。页面结构入口分别是 `src/index.html` 和 `src/photography.html`；重复模板位于 `src/components/`。

## 常见维护操作

### 修改个人介绍

同时修改两个语言 JSON 中的同名键，再运行 `npm run build`。构建时使用英文文案填入静态 HTML；访客切换中文后，浏览器读取中文配置。因此只维护语言文件，不需要再修改 HTML 中的另一份默认文字。

语言文件内的少量 `<br>` 和 `<a>` 是现有的受信任站点内容，用来保留换行和机构链接；不要放入未经检查的外部 HTML。

### 添加新闻

参考 `src/data/news.json` 中相邻条目的字段添加一条记录，再运行构建。新闻按配置顺序展示，不需要复制整段 HTML。

新闻保持原有的中英文同时显示方式。简历按钮文字在数据文件中维护，而不使用不存在的翻译键。

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
| `featured` | 布尔值；设为 `true` 的照片用于精选展示，按数据文件顺序排列 |

年份按从新到旧排列。同一年内先按真实设备分组，设备组按数据中的首次出现顺序排列；同组有可靠拍摄日期的照片按日期从新到旧排列，无日期的照片随后保留原始顺序。文件夹年份只是归档年份，设备未知会显示“设备未记录”。已知品牌但型号未记录时保留品牌，不猜测具体型号。胶片相机标注为胶片拍摄；只有明确的设备说明才会写为扫描设备，处理软件名称也不能当作拍摄相机。

补充记录时同时准备缩略图和预览图，再运行构建。构建会拒绝重复标识、无效日期、与 EXIF 日期矛盾的年份、缺少资源或不存在的翻译。大图预览、设备筛选与年份筛选只是静态画廊之上的增强功能。

摄影页的年份滑杆只在实际存在照片的年份之间切换，默认显示最新年份。设备列表始终显示全部相机；如果选择的相机在当前年份没有照片，会自动切换到全部年份，展示该相机的作品。换到新年份后，如果之前选择的设备在该年没有照片，会自动清除设备筛选。带设备参数的链接也保留该设备，必要时展开全部年份。需要所有年份总览时，可打开 `photography.html?year=all`。关闭 JavaScript 时不启用筛选，所有年份与照片仍完整可浏览。

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

在对应数据文件中参考已有记录添加图片和链接；为新条目使用的文案键同时补充中英文翻译。构建会检查引用的翻译和本地资源，避免发布缺少图片或文案的卡片。

### 更新简历

把新 PDF 放入 `assets/pdf/`，然后更新 `src/data/resumes.json` 中的链接。仅上传新 PDF 不会自动更新下载按钮。

## 检查与发布

```sh
npm run build
npm run check
npm test
```

`check` 只检查，不改写文件；如果任一页面的源文件已更新但相应 HTML 尚未重新生成，会提示具体文件。构建先校验全部页面，再写入输出，包含两页之间的链接及锚点、本地图片路径大小写和中英文翻译。测试覆盖多页生成、过期文件检查、摄影年份/设备/日期排序及核心交互的边界情况。本地预览还应检查手机布局、语言和主题切换、首页轮播，以及摄影页筛选、大图预览和键盘操作。

GitHub Pages 继续发布仓库根目录的静态文件，无需安装服务器框架或更换托管方式。发布修改时，源文件和最新生成的 `index.html`、`photography.html` 应一起提交；保留 `assets/`、`favicon.ico` 和 `CNAME`。本地构建和预览不会自动提交、推送或发布网站。

## 目录说明

```text
src/
  index.html           页面结构入口
  photography.html     独立摄影页入口
  partials/            导航、页脚、脚本引用
  sections/            九个栏目模板
  components/          重复条目模板
  data/                内容配置
assets/
  css/                 原有主题及响应式样式
  i18n/                中英文文案
  js/main.js           交互初始化入口
  js/modules/          按功能拆分的交互逻辑
  img/                 图片
  pdf/                 简历
scripts/
  build.mjs            生成并校验两个静态页面
  gallery-lib.mjs      摄影元数据校验、分组、排序及静态卡片
  serve.mjs            仅监听本机的预览服务
tests/                 自动化检查
index.html             生成的 GitHub Pages 首页
photography.html       生成的摄影页
```

保留原模板与第三方资源的许可声明，详见 `LICENSE` 和相关资源文件头。
