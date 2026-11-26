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

const evidence = require('../workflows/n8n/exports/evidence.json');
const { execFileSync } = require('node:child_process');
function snapshotAt(commit) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const tree = git('ls-tree', '-r', commit).trimEnd().split('\n').map(line => {
    const [metadata, path] = line.split('\t');
    const [mode, type, sha] = metadata.split(' ');
    return { mode, type, sha, path };
  });
  const script = name => evidence.nodes.find(n => n.name === name).parameters.jsCode;
  const paths = new Function('$json', script('허용 경로'))({ tree });
  const blobs = paths.map(({json: item}) => ({json: {
    sha:item.sha, encoding:'base64', content:Buffer.from(git('show', commit + ':' + item.path)).toString('base64')
  }}));
  const context = name => name === '허용 경로' ? {all:() => paths} : {first:() => ({json:{repo:'demo',commit}})};
  return new Function('$input','$','Buffer',script('목차 구성'))({all:() => blobs},context,Buffer)[0].json;
}

test('세 기준 커밋의 현재 명세와 코드에서 검색 도입 전·불일치·도입 후를 구별한다', () => {
  for (const [sha, spec, implementation] of [
    ['a49f726',false,false], ['a59f785',false,true], ['6aed646',true,true]
  ]) {
    const basis = snapshotAt(sha);
    assert.equal(basis.index.some(doc => doc.headings.includes('### Requirement: 상품명으로 목록 검색')), spec);
    assert.equal(Object.values(basis.code).some(code => /findByName/.test(code)), implementation);
    assert.ok(Object.keys(basis.docs).every(path => path.startsWith('openspec/specs/')));
    assert.ok(!JSON.stringify(basis.code).includes('spring.datasource.password'));
  }
});

test('불완전한 Git 트리와 상품 범위 밖의 파일은 근거로 쓰지 않는다', () => {
  assert.throws(() => run(evidence,'허용 경로',{truncated:true,tree:[]},{}), /불완전/);
  assert.throws(() => run(evidence,'허용 경로',{tree:[{path:'key/token.txt',type:'blob',mode:'100644'}]},{}), /누락/);
});

test('Discord 완료 예시가 승인 판본 및 GitHub 생성 입력까지 보존된다', () => {
  const bridge = require('../workflows/n8n/exports/discord.json');
  const example = '노트 검색 시 노트북도 반환한다.';
  const body = '## 무엇이 불편한가\n\n이름 일부만 기억한다.\n\n## 어떤 동작을 원하는가\n\n부분 검색\n\n## 완료됐다고 볼 예시\n\n'+example;
  const saved = run(bridge,'Discord 입력',{body:{...feature,body,action:'draft',request_id:'discord:123456789012345678',request_text:request.text,spec_sha:request.sha}},{});
  const approved = run(review,'검토 결정',{...saved,review_token:'seen',state:'pending'},{
    '검토 입력':{decision:'승인',token:'seen'}
  });
  assert.equal(approved.body,saved.body);
  assert.ok(approved.body.includes('## 완료됐다고 볼 예시\n\n'+example));
  assert.equal(review.nodes.find(n => n.name === '승인한 이슈 생성').parameters.body,'={{ $json.body }}');
});

test('승인 전 최신성, 게시 실패 후 복구와 모델 호출 회계는 실제 워크플로 경로에서 동작한다', () => {
  const draft = {scope_digest:'same',target_repo:'owner/shop',review_token:'seen'};
  const current = {scope_digest:'same',repo:'owner/shop',commit:request.sha};
  const assess = (basis, update={}) => run(review,'게시 근거 대조',basis,{
    '요청 조회':draft,'검토 입력':{token:'seen',decision:'승인',...update}
  });
  assert.equal(assess(current).recheck,false);
  assert.equal(assess({...current,scope_digest:'new'}).recheck,true);
  assert.equal(assess(current,{decision:'수정 후 재검토'}).recheck,true);
  assert.throws(()=>assess(current,{token:'expired'}));
  assert.throws(()=>assess({...current,commit:null}));
  for (const [wf,model] of [[review,'요청 재판정'],[intake,'AI 분류']]) {
    const next=name=>wf.connections[name].main[0][0].node;
    assert.equal(next('모델 예약'),'예산 경고');
    assert.equal(next('예산 경고'),model);
    assert.equal(next(model),'모델 정산');
  }
});

test('검색 명세를 분리해도 원문과 검색·정렬 조합의 근거가 보존된다', () => {
  const basis = snapshotAt('6aed646');
  const original = Object.values(basis.docs)[0];
  const part = original.indexOf('### Requirement: 상품명으로 목록 검색');
  assert.ok(part > 0);
  const paths = ['openspec/specs/product-catalog/spec.md', 'openspec/specs/product-search/spec.md'];
  const contents = [original.slice(0,part),'# Search\n\n## Purpose\n검색 조건\n\n## Requirements\n\n'+original.slice(part)];
  const code = evidence.nodes.find(n=>n.name==='목차 구성').parameters.jsCode;
  const blobs = contents.map((s,i)=>({json:{encoding:'base64',sha:String(i),content:Buffer.from(s).toString('base64')}}));
  const split = new Function('$input','$','Buffer',code)({all:()=>blobs},name=> name==='허용 경로'
    ? {all:()=>paths.map((path,i)=>({json:{path,sha:String(i)}}))}
    : {first:()=>({json:{repo:'demo',commit:'demo'}})},Buffer)[0].json;
  assert.equal(split.index.flatMap(doc=>doc.headings).length,basis.index.flatMap(doc=>doc.headings).length);
  assert.ok(split.docs[paths[1]].includes('이름 전체가 같은'));
  assert.ok(split.docs[paths[0]].includes('가격 동률'));
  delete split.docs[paths[0]];
  assert.equal(split.docs[paths[0]],undefined);
});

test('기존 판본을 살리는 재판정과 이미 지원 또는 수정으로 재승인하는 경로', () => {
  const repo='owner/shop', commit='a'.repeat(40);
  const current={repo,commit,scope_digest:'new',docs:{'spec.md':'상품 목록 조회'},code:{'P.java':'return list;'}};
  const draft={basis_commit:'old',request_id:'id',review_token:'old',title:'변경',body:'합의',
    category:'새 기능',target_repo:repo,evidence_items:[{path:'spec.md',quote:'상품 목록 조회'},{path:'P.java',quote:'return list;'}]};
  const decide=(category,decision,legacy=false)=>run(review,'새 검토 판본',{choices:[{message:{content:JSON.stringify({
    category,evidence:'상품 목록 조회',code_file:'P.java',code_quote:'return list;',answer:'ok'
  })}}]}, {'최신 상품 근거':current,'요청 조회':{...draft,basis_commit:legacy?null:'old'},'검토 입력':{decision,token:'old'}});
  assert.equal(decide('새 기능','승인').canPublish,true);
  assert.ok(!decide('새 기능','승인',true).canPublish);
  assert.ok(!decide('이미 지원','승인').canPublish);
  assert.ok(!decide('새 기능','수정 후 재검토').canPublish);
});

test('GitHub POST 실패와 응답 유실은 이슈 번호를 만들지 않는다', () => {
  for (const response of [{error:'timeout'}, {}, {number:0}]) {
    const result = run(review,'등록 응답',response,{'결정 반영':{request_id:'one'}});
    assert.deepEqual(result,{id:'one',number:null});
  }
  assert.equal(review.nodes.find(n=>n.name==='승인한 이슈 생성').retryOnFail,false);
});

test('구형 검토 판본의 내용은 재판정으로만 갱신하며 부분 초안을 게시하지 않는다', () => {
  const current={repo:'owner/shop',commit:'c'.repeat(40),scope_digest:'latest',
    docs:{'spec.md':'검색한다'},code:{'Product.java':'return results;'}};
  const incoming={basis_commit:null,target_repo:null,scope_digest:null,request_id:'demo',review_token:'seen',title:'규칙',body:'원문'};
  const edit={'검토 입력':{decision:'승인',token:'seen'},'요청 조회':incoming,'최신 상품 근거':current};
  assert.equal(run(review,'게시 근거 대조',current,edit).recheck,true);
  const result={category:'새 기능',answer:'검토',evidence:'검색한다',code_file:'Product.java',code_quote:'return results;'};
  const fresh=run(review,'새 검토 판본',{choices:[{message:{content:JSON.stringify(result)}}]},edit);
  assert.ok(!fresh.canPublish);
  assert.ok(fresh.body.includes(current.commit) && fresh.body.includes('<!-- team-request:demo -->'));
  assert.throws(()=>run(review,'새 검토 판본',{choices:[{message:{content:JSON.stringify({...result,evidence:'없음'})}}]},edit));
});

test('폼은 명세와 코드가 충돌하거나 원격 조회 실패 시 초안을 만들지 않는다', () => {
  const data={...request,docs:{'spec.md':request.spec},code:{'Product.java':'findByName(name)'}};
  const answer={...feature,spec_support:false,code_support:true,code_file:'Product.java',code_quote:'findByName(name)'};
  const result=run(intake,'근거 확인',{choices:[{message:{content:JSON.stringify(answer)}}]},{'분류 입력':data});
  assert.equal(result.state,'answered');
  assert.equal(result.category,'확인 필요');
  assert.equal(result.body,'');
  assert.equal(intake.connections['기준 명세'].main[1][0].node,'근거 확인 필요');
  assert.equal(intake.connections['근거 확인 필요'].main[0][0].node,'접수 완료');
});

test('결합 문의는 검색·정렬 근거를 확인하고 공통 설정은 허용된 값만 제공한다', () => {
  const basis=snapshotAt('6aed646');
  const specPath=Object.keys(basis.docs)[0];
  const controller='src/main/java/com/example/shop/product/ProductController.java';
  const service='src/main/java/com/example/shop/product/ProductService.java';
  assert.ok(basis.code['src/main/resources/application.properties'].includes('spring.mvc.problemdetails.enabled=true'));
  const evidenceText='상품명으로 목록 검색';
  const input={...request,spec:Object.values(basis.docs).join('\n'),code:basis.code,docs:basis.docs};
  const result={...feature,category:'이미 지원',evidence:evidenceText,code_file:service,
    code_quote:'products.findByName(name, sort)',spec_support:true,code_support:true,
    conditions:[{spec_path:specPath,evidence:'가격 동률',code_file:controller,code_quote:'Sort.by("price").ascending().and(byId)'}]};
  const classify = () => run(intake,'근거 확인',{choices:[{message:{content:JSON.stringify(result)}}]},{'분류 입력':input});
  assert.equal(classify().category,'이미 지원');
  result.conditions[0].spec_path='missing.md';
  assert.equal(classify().category,'확인 필요');
});
