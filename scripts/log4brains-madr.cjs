const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// ADR 원본을 수정하지 않고 Log4brains의 읽기 모델에 메타데이터를 전달한다.
module.exports = function readMadr(markdown, filename) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return markdown;
  const data = yaml.parse(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`MADR 메타데이터가 올바르지 않습니다: ${filename}`);
  }
  if (!['draft', 'proposed', 'rejected', 'accepted', 'deprecated', 'superseded'].includes(data.status)) {
    throw new Error(`Log4brains에서 지원하지 않는 ADR 상태: ${data.status}`);
  }
  if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error(`ADR 날짜는 YYYY-MM-DD 형식이어야 합니다: ${filename}`);
  }
  const links = data.links || [];
  let status = data.status;
  const superseder = links.find(link => link.kind.replace(/[^a-z]/gi, '').toLowerCase() === 'supersededby');
  if (superseder) {
    const prefix = `${String(superseder.target).padStart(4, '0')}-`;
    const targets = fs.readdirSync(path.dirname(filename)).filter(name => name.startsWith(prefix) && name.endsWith('.md'));
    if (targets.length !== 1) throw new Error(`대체 ADR을 하나로 찾을 수 없습니다: ${superseder.target}`);
    status = `superseded by [${targets[0].slice(0, -3)}](${targets[0]})`;
  }
  const body = match[2].trimStart();
  if (!/^# [^\n]+\r?\n/.test(body)) throw new Error(`ADR의 첫 줄에 제목이 필요합니다: ${filename}`);
  return body.replace(/^(#[^\n]*\n)/, `$1\n- Status: ${status}\n- Date: ${data.date}\n`);
};
