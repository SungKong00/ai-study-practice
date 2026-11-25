const assert = require('node:assert/strict');
const { test } = require('node:test');
const intake = require('../workflows/n8n/exports/intake.json');
const review = require('../workflows/n8n/exports/review.json');

function run(workflow, name, input, upstream) {
  const node = workflow.nodes.find(candidate => candidate.name === name);
  const execute = new Function('$json', '$', node.parameters.jsCode);
  const lookup = key => ({ first: () => ({ json: upstream[key] }) });
  return execute(input, lookup)[0].json;
}

const request = {
  id: 'study-42', text: '상품 가격을 바꾸고 싶어요.', sha: 'a'.repeat(40),
  spec: '상품은 이름과 가격을 전송해 등록한다.'
};
const feature = {
  category: '새 기능', evidence: '이름과 가격을 전송해 등록한다.', answer: '가격 변경을 제안합니다.',
  title: '가격 변경', body: '등록 뒤 가격을 바꾼다.'
};
function classify(answer) {
  return run(intake, '근거 확인', { choices: [{ message: { content: JSON.stringify(answer) } }] }, { '분류 입력': request });
}

test('분류는 명세의 실제 인용문을 요구하고 새 기능만 검토 대기열에 넣는다', () => {
  assert.throws(() => classify({ ...feature, evidence: '가격 변경을 지원한다.' }), /인용문/);
  assert.equal(classify({ ...feature, category: '이미 지원' }).state, 'answered');
  assert.equal(classify({ ...feature, category: '확인 필요' }).body, '');
  const draft = classify(feature);
  assert.equal(draft.state, 'pending');
  assert.ok(draft.body.includes(feature.evidence));
  assert.ok(draft.body.endsWith('<!-- team-request:study-42 -->'));
});

test('승인은 본 초안에만 적용되고 편집한 본문에는 원래 근거와 요청 ID가 붙는다', () => {
  const draft = { ...classify(feature), request_id: request.id, spec_sha: request.sha, review_token: 'viewed' };
  const decide = (action, fields = {}) => run(review, '검토 결정', draft, {
    '검토 입력': { decision: action, token: 'viewed', ...fields }
  });
  assert.throws(() => decide('승인', { token: 'old' }), /검토 코드/);
  assert.throws(() => decide('승인', { title: '새 제목' }), /수정 후 재검토/);
  assert.equal(decide('승인').body, draft.body);
  assert.equal(decide('승인').state, 'publishing');
  assert.equal(decide('거절').state, 'rejected');
  const edit = decide('수정 후 재검토', { body: '수정한 제안' });
  assert.equal(edit.state, 'pending');
  assert.equal(edit.body, draft.body.replace(feature.body, '수정한 제안'));
});

test('생성 응답 유실 시 저장한 제목·본문이 일치하는 GitHub 이슈만 연결한다', () => {
  const draft = classify(feature);
  const match = issue => run(review, '등록 내용 대조', issue, { '요청 조회': { ...draft, request_id: request.id } });
  const issue = { number: 7, title: draft.title, body: draft.body };
  assert.deepEqual(match(issue), { id: request.id, number: 7 });
  assert.throws(() => match({ ...issue, title: '다른 요청' }), /일치/);
  assert.throws(() => match({ ...issue, pull_request: {} }), /일치/);
});

test('Discord 초안은 폼 ID와 분리하고 실제 승인에 쓸 식별자를 본문에 남긴다', () => {
  const bridge = require('../workflows/n8n/exports/discord.json');
  const draft = { ...feature, action: 'draft', request_id: 'discord:123456789012345678',
    spec_sha: request.sha, request_text: request.text };
  const input = body => run(bridge, 'Discord 입력', { body }, {});
  assert.throws(() => input({ ...draft, request_id: 'study-42' }));
  assert.throws(() => input({ ...draft, action: '다른 동작' }));
  assert.throws(() => run(intake, '입력 확인', draft, {}));
  assert.ok(input(draft).body.endsWith('<!-- team-request:' + draft.request_id + ' -->'));
  assert.equal(input({ ...draft, action: 'approve', token: 'seen' }).decision, '승인');
});
