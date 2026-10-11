import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {renderSite} from '../scripts/build-lib.mjs';
import {scriptJson} from '../scripts/site-metadata.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));

test('every public page has one canonical URL, translated metadata and a share card', async()=>{
  const {pages,files}=await renderSite(root);
  assert.equal(Object.keys(pages).length,5);
  for(const [name,{html}] of Object.entries(pages)) {
    const path=name==='index.html'?'/':'/'+name;
    assert.equal((html.match(/<title\b/g)||[]).length,1);
    assert.equal((html.match(/name="description"/g)||[]).length,1);
    assert.ok(html.includes(`rel="canonical" href="https://menghongdao.com${path}"`));
    assert.match(html,/property="og:image" content="https:\/\/menghongdao.com\/assets\/img\/social-card.png"/);
    const embedded=html.match(/id="content-translations">([\s\S]*?)<\/script>/);
    assert.ok(embedded);
    const dictionaries=JSON.parse(embedded[1]);
    assert.equal(dictionaries.cn.seo__locale,'zh_CN');
    assert.ok(files['sitemap.xml'].includes(`<loc>https://menghongdao.com${path}</loc>`));
  }
  assert.ok(files['robots.txt'].includes('Sitemap: https://menghongdao.com/sitemap.xml'));
  const png=await readFile(join(root,'assets/img/social-card.png'));
  assert.equal(png.readUInt32BE(16),1200);
  assert.equal(png.readUInt32BE(20),630);
});

test('inline data cannot terminate its script element or lose multilingual text',()=>{
  const data={en:{value:'</script><img src=x onerror=bad>&'},cn:{value:'中文 < 内容'}};
  const encoded=scriptJson(data);
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded),data);
});
