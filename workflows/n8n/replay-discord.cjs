// Read-only evaluation using the same prompts, evidence IDs and reconciliation as n8n.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { modelInput, decide } = require('./discord-conversation.cjs');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const skills = {
  explore: fs.readFileSync('.agents/skills/openspec-explore/SKILL.md', 'utf8'),
  refinement: fs.readFileSync('.agents/skills/discord-issue-refinement/SKILL.md', 'utf8'),
};
async function replay(tag, expected) {
  const commit = git('rev-parse', tag).trim();
  const path = 'openspec/specs/product-catalog/spec.md';
  const files = git('ls-tree', '-r', '--name-only', commit, 'src/main/java/com/example/shop/product')
    .trim()
    .split('\n');
  const basis = {
    commit,
    repo: 'SungKong00/ai-study-practice',
    tests: {},
    docs: { [path]: git('show', commit + ':' + path) },
    code: Object.fromEntries(files.map((f) => [f, git('show', commit + ':' + f)])),
  };
  const ctx = { topic: '상품 조회', turns: [{ role: 'user', content: '상품명으로만 찾을 수 있어요?' }] };
  let input = modelInput(ctx, basis, skills, 'lookup');
  for (let i = 0; i < 3; i++) {
    const url = 'https://api.openai.com/v1/chat/completions',
      body = input.payload;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Error('OpenAI ' + r.status);
    const message = (await r.json()).choices[0].message;
    const result = decide(input, message, skills, '');
    if (result.next) {
      input = result.next;
      continue;
    }
    const kind =
      input.stage === 'verify' && result.text?.includes('/blob/' + commit + '/')
        ? input.previous.kind
        : message.content && JSON.parse(message.content).kind === 'ask'
          ? 'ask'
          : 'check';
    console.log(tag, expected, kind);
    if (kind !== expected || !result.text || result.draft) process.exitCode = 1;
    return;
  }
  throw Error(tag + ' 평가 호출 상한 도달');
}
(async () => {
  if (!process.env.OPENAI_API_KEY) throw Error('실습 OpenAI 키가 필요합니다.');
  for (const [tag, kind] of [
    ['a49f726', 'unsupported'],
    ['a59f785', 'check'],
    ['6aed646', 'supported'],
  ])
    await replay(tag, kind);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
