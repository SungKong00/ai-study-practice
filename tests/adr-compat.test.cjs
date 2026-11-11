const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Log4brains } = require('@log4brains/core');

const project = path.resolve(__dirname, '..');
const binary = path.join(project, '.tools/bin/adrs');

test('adrs의 MADR 원본을 상태·날짜·대체 관계 그대로 읽고 보존한다', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-study-adr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cli = (...args) => execFileSync(binary, args, { cwd: root, encoding: 'utf8' });
  cli('--ng', 'init', 'docs/adr');
  fs.writeFileSync(path.join(root, 'adrs.toml'), [
    'adr_dir = "docs/adr"', 'mode = "ng"', 'no_edit = true',
    '[templates]', 'format = "madr"',
    `custom = ${JSON.stringify(path.join(project, 'docs/adr/template.md'))}`, ''
  ].join('\n'));
  fs.writeFileSync(path.join(root, '.log4brains.yml'), 'project:\n  name: ADR compatibility\n  tz: Asia/Seoul\n  adrFolder: ./docs/adr\n');
  const title = '원본: 한글 "상태" 확인';
  cli('new', '--status', 'proposed', title);
  const directory = path.join(root, 'docs/adr');
  const original = path.join(directory, fs.readdirSync(directory).find(name => name.startsWith('0002-')));
  fs.writeFileSync(original, fs.readFileSync(original, 'utf8')
    .replace(/date: \d{4}-\d{2}-\d{2}/, 'date: 2001-02-03')
    .replace('- 검토한 대안을 적는다.', '- 보존되어야 하는 검토 대안'));
  const read = () => Log4brains.create(root).searchAdrs();
  const before = fs.readFileSync(original, 'utf8');
  let rows = await read();
  let record = rows.find(row => row.title === title);
  assert.equal(record.status, 'proposed');
  assert.equal(record.publicationDate, '2001-02-03T14:59:59.000Z');
  assert.equal(record.file.absolutePath, original);
  assert.equal(fs.readFileSync(original, 'utf8'), before);

  cli('status', '2', 'accepted');
  rows = await read();
  assert.equal(rows.find(row => row.title === title).status, 'accepted');
  cli('new', '--status', 'accepted', '--supersedes', '2', 'replacement-decision');
  const afterChange = fs.readFileSync(original, 'utf8');
  rows = await read();
  record = rows.find(row => row.title === title);
  const replacement = rows.find(row => row.title === 'replacement-decision');
  assert.equal(record.status, 'superseded');
  assert.equal(record.supersededBy, replacement.slug);
  assert.equal(record.publicationDate, '2001-02-03T14:59:59.000Z');
  assert.match(afterChange, /보존되어야 하는 검토 대안/);
  assert.equal(fs.readFileSync(original, 'utf8'), afterChange);

  const api = Log4brains.create(root);
  await assert.rejects(api.createAdrFromTemplate('unexpected', 'unexpected'), /조회 전용/);
  await assert.rejects(api.supersedeAdr(record.slug, replacement.slug), /조회 전용/);
  assert.equal(fs.readFileSync(original, 'utf8'), afterChange);
});
