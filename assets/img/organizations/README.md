# Timeline organization marks

These local assets identify the companies and schools in the Experience timeline. Sources were verified on 2026-10-10. Marks retain their original colors and proportions; they belong to their respective organizations.

| File | Official source | Dimensions |
| --- | --- | --- |
| `tiktok.png` | [TikTok design guidelines](https://developers.tiktok.com/doc/getting-started-design-guidelines/) · [asset](https://lf16-tiktok-common.ttwstatic.com/obj/tiktok-web-common-sg/mtact/static/images/logo_144c91a.png) | 400 × 400 |
| `qingteng.png` | [QingTeng homepage](https://www.qingteng.cn/), embedded favicon | 32 × 32 |
| `c2smarter.png` | [C2SMARTER](https://c2smart.engineering.nyu.edu/) · [asset](https://c2smart.engineering.nyu.edu/wp-content/uploads/2021/07/cropped-C2Smart_Square-192x192.png) | 192 × 192 |
| `freeleaps.png` | [Freeleaps](https://freeleaps.com/home/) · [favicon](https://freeleaps.com/favicon.ico) | 64 × 64 |
| `nyu.png` | [NYU Stern](https://www.stern.nyu.edu/) · [favicon](https://www.stern.nyu.edu/themes/custom/stern9/favicon.ico) | 48 × 48 |
| `bjut.png` | [BJUT identity guide](https://www.bjut.edu.cn/dxwh/gdbs1.htm) · [asset](https://www.bjut.edu.cn/__local/0/3B/29/B0955FD37DB3B273D1C31678217_6AA6537D_9507.png?e=.png) | 180 × 181 |
| `beijing-no8.png` | [Beijing No. 8 High School](https://www.no8ms.bj.cn/cms/home/) · [favicon](https://www.no8ms.bj.cn/favicon.ico) | 32 × 32 |

ICO resources were converted to PNG without cropping or recoloring. Display marks at no more than 32 CSS pixels so the smallest source assets stay crisp.

Edit organization names, logo paths, website URLs, and LinkedIn destinations in the `organizations` object in `src/data/experience.json`, then run `npm run build`. Work and education entries in the same file reference these shared organizations and store their bilingual roles and date periods. This is the single content source; do not duplicate dates or institutional links in the section template or language dictionaries.

`scripts/home-data.mjs` validates and formats the data, and `src/components/experience-item.html` renders each timeline entry. `src/sections/qualification.html` contains the section and tab structure. The unnamed startup uses a decorative inline SVG symbol. The research lab uses BJUT's mark, as confirmed by the site owner. Logo images use empty alt text; clickable marks have a bilingual text label that names the destination and announces the new tab. Work and education buttons retain the same hover, press, and focus effects.

## Work timeline LinkedIn destinations

Verified against each LinkedIn profile's official website field on 2026-10-10:

- [TikTok](https://www.linkedin.com/company/tiktok/) — tiktok.com
- [C2SMARTER](https://www.linkedin.com/company/c2smart-center/) — c2smart.engineering.nyu.edu
- [Freeleaps](https://www.linkedin.com/company/freeleaps/) — freeleaps.com
- [QingTeng Cloud Security](https://www.linkedin.com/company/%E9%9D%92%E8%97%A4%E4%BA%91%E5%AE%89%E5%85%A8/) — qingteng.cn
- [Beijing University of Technology](https://www.linkedin.com/school/beijing-university-of-technology/) — bjut.edu.cn; used for the Data Mining & Security Lab entry.

The site owner requested leaving the unnamed DeepFake startup unlinked.

## Education timeline LinkedIn destinations

School buttons reuse the work timeline's link markup, interaction styles, and bilingual new-tab labels. Verified on 2026-10-10:

- [New York University](https://www.linkedin.com/school/new-york-university/) — LinkedIn school page identifies NYU and nyu.edu.
- [Beijing University of Technology](https://www.linkedin.com/school/beijing-university-of-technology/) — bjut.edu.cn, also used by the research lab entry.
- [Beijing No.8 High School](https://www.linkedin.com/school/no8ms/) — indexed LinkedIn school page names Beijing No.8 High School, links no8ms.bj.cn, and lists Xicheng District, Beijing and a 1921 founding date.
