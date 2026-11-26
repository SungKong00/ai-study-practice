const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('../workflows/n8n/discord-workflow.cjs');
const {
  modelInput,
  decide,
  preview,
  interaction,
  conversation,
} = require('../workflows/n8n/discord-conversation.cjs');
const settings = Object.fromEntries(
  ['guild', 'forum', 'role', 'bot'].map((k, i) => [k, String(123456789012345670n + BigInt(i))]),
);
const [model, flow] = build(settings);
const basis = {
  docs: { spec: '상품 목록' },
  code: { java: 'list()' },
  tests: {},
  commit: 'a'.repeat(40),
  index: [{ path: 'spec', sha: 'b'.repeat(40) }],
  scope_digest: 'scope',
  repo: 'owner/shop',
};
const ctx = {
  topic: '검색',
  turns: [{ role: 'user', content: '노트' }],
  turnId: 'discord:123456789012345678:123456789012345679',
  thread: 'https://discord.com/channels/1/2',
};
const skills = { explore: '탐색', refinement: '구체화' };
const template = fs.readFileSync('.github/ISSUE_TEMPLATE/feature.md', 'utf8').split('\n---\n')[1].trim();
const finding = {
  kind: 'draft',
  intent: 'change',
  title: '검색 확장',
  answer: '예시',
  spec_id: 'S0.1',
  code_id: 'C0.1',
  conditions: [],
  problem: '찾기 어려움',
  behavior: '부분 검색',
  example: '노트로 노트북 검색',
};
const answer = (stage, obj) =>
  decide(modelInput(ctx, basis, skills, stage), { content: JSON.stringify(obj) }, skills, template);
test('배포할 노드·연결과 스킬 원문, 예산·승인 경계를 확인한다', () => {
  for (const wf of [flow, model]) {
    const nodes = new Set(wf.nodes.map((n) => n.name));
    for (const [source, { main }] of Object.entries(wf.connections)) {
      assert.ok(nodes.has(source));
      for (const n of main.flat()) assert.ok(nodes.has(n.node));
    }
    for (const node of wf.nodes.filter((n) => n.type.endsWith('.code'))) new Function(node.parameters.jsCode);
    assert.equal(wf.settings.saveDataSuccessExecution, 'none');
  }
  assert.ok(flow.nodes.find((n) => n.type.endsWith('.discordTrigger')));
  assert.ok(flow.nodes.find((n) => n.name === '질문 준비').parameters.jsCode.includes('openspec-explore'));
  assert.deepEqual(
    model.connections['예산 예약'].main[0].map((n) => n.node),
    ['예산 경고'],
  );
  assert.deepEqual(
    flow.connections['버튼 즉시 응답'].main[0].map((n) => n.node),
    ['승인한 요청'],
  );
  assert.ok(!flow.nodes.some((n) => n.type.endsWith('.webhook')));
});
test('다른 서버·포럼·봇·웹훅을 제외한다', () => {
  const filter = new Function('$json', flow.nodes.find((n) => n.name === '서버와 이벤트').parameters.jsCode);
  const msg = {
    type: 0,
    content: '문의',
    id: settings.role,
    channel_id: settings.forum,
    guild_id: settings.guild,
    author: {},
  };
  for (const alter of [{ guild_id: 'wrong' }, { author: { bot: true } }, { webhook_id: 'id' }, { type: 7 }]) {
    assert.deepEqual(filter({ event: 'MESSAGE_CREATE', data: { ...msg, ...alter } }), []);
  }
  assert.equal(filter({ event: 'MESSAGE_CREATE', data: msg }).length, 1);
  const forum = new Function('$json', '$', flow.nodes.find((n) => n.name === '지정 포럼').parameters.jsCode);
  assert.deepEqual(
    forum({ type: 11, parent_id: 'other' }, () => ({ first: () => ({ json: { settings } }) })),
    [],
  );
  assert.match(flow.nodes.find((n) => n.name === '이벤트 접수').parameters.query, /ON CONFLICT DO NOTHING/);
});
test('모호한 문의는 질문, 명확한 변경은 같은 양식의 초안으로만 전달한다', () => {
  assert.ok(answer('lookup', finding).next);
  assert.deepEqual(answer('medium', { ...finding, kind: 'ask' }), { text: '**요구사항 구체화**\n예시' });
  const { draft } = answer('medium', finding);
  assert.ok(draft.body.includes('## 완료됐다고 볼 예시\n\n노트로 노트북 검색'));
  assert.ok(draft.body.includes(ctx.thread));
  assert.equal(draft.action, 'draft');
  assert.equal(
    answer('medium', { ...finding, conditions: [{ spec_id: 'S0.1', code_id: 'C9.1' }] }).draft,
    undefined,
  );
});
test('같은 스레드의 대화와 독립적인 구현 확인을 사용한다', () => {
  const turns = conversation(
    [
      { id: '1', author: { bot: true, id: 'other' }, content: '**영향 분석**' },
      { id: '2', author: { bot: true, id: settings.bot }, content: '**요구사항 구체화**' },
    ],
    { content: '싼 순', author: { id: 'user' } },
    { name: '상품' },
    settings,
  );
  assert.equal(turns.stage, 'medium');
  assert.equal(turns.turns.length, 2);
  const f = { ...finding, intent: 'lookup', kind: 'supported', spec_support: true, code_support: true };
  const { next } = answer('lookup', f);
  assert.equal(next.stage, 'verify');
  assert.ok(!next.payload.messages[1].content.includes('상품 목록'));
  assert.match(
    decide(next, { content: JSON.stringify({ supports: false, code_id: 'C0.1' }) }, skills, template).text,
    /확인/,
  );
  assert.equal(answer('lookup', { ...f, spec_support: false }).next, undefined);
});
test('추론 모델도 허용된 파일만 한 번 추가 조회한다', () => {
  const input = modelInput(ctx, basis, skills, 'high');
  assert.equal(input.payload.reasoning_effort, 'high');
  const read = (path) => ({ content: JSON.stringify({ read_path: path }) });
  const { next } = decide(input, read('spec'), skills, template);
  assert.equal(JSON.parse(next.payload.messages.at(-1).content).source, '상품 목록');
  assert.equal(decide(next, read('spec'), skills, template).next, undefined);
  assert.equal(decide(input, read('key/other'), skills, template).next, undefined);
});
test('권한, 수정 모달, 예전 버튼과 재클릭을 실제 처리 분기에서 검증한다', () => {
  const row = { title: '상품', body: '초안', token: 'v2', state: 'pending' };
  const click = (id, roles, type = 3, components = []) => ({
    type,
    data: { custom_id: id, components },
    member: { roles },
  });
  assert.equal(interaction(click('approve:v2', []), settings.role, row).review, undefined);
  const stale = interaction(click('approve:v1', [settings.role]), settings.role, row);
  assert.equal(stale.review, undefined);
  assert.equal(stale.show, true);
  assert.equal(interaction(click('approve:v1', []), settings.role, row).show, undefined);
  assert.equal(interaction(click('edit:v2', [settings.role]), settings.role, row).callback.type, 9);
  assert.equal(
    interaction(click('approve:v2', [settings.role]), settings.role, row).review.action,
    'approve',
  );
  assert.ok(interaction(click('approve:v2', [settings.role]), settings.role, { state: 'published' }).show);
  const parts = preview({ ...row, body: '가'.repeat(4400) }, 'owner/shop');
  assert.equal(
    parts
      .slice(1, -1)
      .map((p) => p.content)
      .join('').length,
    4400,
  );
  assert.ok(parts.at(-1).components);
});

test('수정 판정은 선택한 줄 ID에서 실제 원문과 경로를 복원한다', () => {
  const review = require('../workflows/n8n/exports/review.json');
  const script = (name) => new Function('$', review.nodes.find((n) => n.name === name).parameters.jsCode);
  const values = {
    '최신 상품 근거': basis,
    '검토 입력': { title: '가격 상한', body: '5000원 포함' },
    '요청 조회': {},
  };
  const lookup = (name) => ({ first: () => ({ json: values[name] }) });
  const input = script('모델 입력')(lookup)[0].json;
  values['모델 입력'] = input;
  function restore(spec_id, code_id) {
    values['요청 재판정'] = {
      choices: [{ message: { content: JSON.stringify({ category: '새 기능', spec_id, code_id }) } }],
    };
    return JSON.parse(script('응답 복원')(lookup)[0].json.choices[0].message.content);
  }
  assert.equal(restore('S0.1', 'C0.1').code_quote, 'list()');
  assert.throws(() => restore('C0.1', 'C0.1'));
  assert.throws(() => restore('S9.99', 'C0.1'));
});
