const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const directory = path.dirname(require.resolve('@log4brains/core'));
const adapter = JSON.stringify(path.join(__dirname, 'log4brains-madr.cjs'));
const marker = `/* ai-study: MADR reader */ require(${adapter})`;
const entries = {
  'index.js': 'c3e81c0e7be417e0cbceb61bbe8bf0eddf8cd1024961619a94d2641f3a191e86',
  'index.module.js': '346185a4e157ff01daa89297cd316c6fb463303106568ef162708ccb6dc3b27c'
};
// CLI와 웹 빌드가 서로 다른 진입점을 사용하므로 둘 다 적용한다.
const updates = [];
for (const [entry, expectedHash] of Object.entries(entries)) {
  const file = path.join(directory, entry);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(marker)) continue;
  if (crypto.createHash('sha256').update(source).digest('hex') !== expectedHash) {
    throw new Error('Log4brains 원본 버전이 달라졌습니다. npm ci로 복원하거나 MADR 호환성을 재검증하세요.');
  }
  let patched = source.replace(
    'new MarkdownBody(markdown).setAdrLinkResolver(this.markdownAdrLinkResolver)',
    `new MarkdownBody(${marker}(markdown, adrFile.path.absolutePath)).setAdrLinkResolver(this.markdownAdrLinkResolver)`
  );
  for (const signature of ['async createAdrFromTemplate(slug, title) {', 'async supersedeAdr(supersededSlug, supersederSlug) {']) {
    if (!patched.includes(signature)) throw new Error('Log4brains 쓰기 API가 변경되었습니다.');
    patched = patched.replace(signature, `${signature}\n    throw new Error("Log4brains는 조회 전용입니다. ADR 변경에는 adrs를 사용하세요.");`);
  }
  updates.push([file, patched]);
}
for (const [file, patched] of updates) fs.writeFileSync(file, patched);
if (updates.length) {
  // 패키지에 포함된 기존 웹 빌드는 호환 코드를 반영하지 않았으므로 다시 만든다.
  const webDirectory = path.resolve(path.dirname(require.resolve('@log4brains/web')), '..');
  fs.rmSync(path.join(webDirectory, 'nextjs/.next'), { recursive: true, force: true });
  console.log('Log4brains 1.1.0에 MADR 원본 읽기 호환 코드를 적용했습니다.');
}
const previewBuild = path.resolve(path.dirname(require.resolve('@log4brains/web')), '../nextjs/.next/BUILD_ID');
if (!fs.existsSync(previewBuild)) {
  // Log4brains 공식 실행 파일과 동일한 OpenSSL 옵션을 이 빌드 프로세스에만 적용한다.
  execFileSync(process.execPath, [path.join(__dirname, 'build-log4brains-preview.cjs')], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--openssl-legacy-provider' }
  });
}
