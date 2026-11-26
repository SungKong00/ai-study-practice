// Build importable n8n workflows with the repository's actual skills and issue template.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const logic = require('./discord-conversation.cjs');
function build(settings) {
  for (const key of ['guild', 'forum', 'role', 'bot'])
    if (!/^\d{15,22}$/.test(settings[key])) throw Error('Discord ID 필요: ' + key);
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const skills = Object.fromEntries(
    [
      ['explore', 'openspec-explore'],
      ['refinement', 'discord-issue-refinement'],
    ].map(([k, v]) => [k, read('.agents/skills/' + v + '/SKILL.md')]),
  );
  const template = read('.github/ISSUE_TEMPLATE/feature.md').split('\n---\n')[1].trim();
  const bridge = JSON.parse(read('workflows/n8n/exports/discord.json'));
  const settingsNode = 'const settings=' + JSON.stringify(settings) + ';\n';
  const modelFns = logic.modelInput.toString() + '\nconst skills=' + JSON.stringify(skills) + ';\n';
  const flow = (id, name) => ({
    id,
    name,
    nodes: [],
    connections: {},
    settings: { ...bridge.settings, saveExecutionProgress: false },
  });
  let wf = flow('TeamDiscordModel', 'Discord · 모델 호출과 예산');
  const model = wf;
  const versions = {
    code: 2,
    if: 2.2,
    httpRequest: 4.2,
    executeWorkflow: 1.3,
    executeWorkflowTrigger: 1.1,
    postgres: 2.8,
  };
  function node(name, type, parameters, position, extra = {}) {
    wf.nodes.push({
      name,
      id: 'node-' + wf.nodes.length,
      type: 'n8n-nodes-base.' + type,
      typeVersion: versions[type],
      parameters,
      position,
      ...extra,
    });
    return name;
  }
  function edge(from, to, branch = 0) {
    const { main } = (wf.connections[from] ??= { main: [] });
    (main[branch] ??= []).push({ node: to, type: 'main', index: 0 });
  }
  function chain(...steps) {
    for (let i = 1; i < steps.length; i++) edge(steps[i - 1], steps[i]);
  }
  const code = (name, jsCode, x, y) => node(name, 'code', { jsCode }, [x, y]);
  const pg = (name, query, params, x, y) =>
    node(
      name,
      'postgres',
      { operation: 'executeQuery', query, options: { queryReplacement: '={{ ' + params + ' }}' } },
      [x, y],
    );
  const internal = (name, id, x, y) =>
    node(
      name,
      'executeWorkflow',
      { workflowId: { __rl: true, value: id, mode: 'id' }, options: { waitForSubWorkflow: true } },
      [x, y],
    );
  function test(name, cond, x, y) {
    const p = structuredClone(bridge.nodes.find((n) => n.type.endsWith('.if')).parameters);
    p.conditions.conditions[0].leftValue = '={{ ' + cond + ' }}';
    return node(name, 'if', p, [x, y]);
  }
  const http = (name, method, url, auth, body, x, y, options = {}) =>
    node(
      name,
      'httpRequest',
      {
        method,
        url,
        ...(auth ? { authentication: 'predefinedCredentialType', nodeCredentialType: auth } : {}),
        ...(body
          ? { sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify(' + body + ') }}' }
          : {}),
        options: { timeout: 60000, ...options },
      },
      [x, y],
    );
  const start = node('모델 요청', 'executeWorkflowTrigger', { inputSource: 'passthrough' }, [0, 0]);
  const reserve = pg(
    '예산 예약',
    'SELECT * FROM team_model_reserve($1,$2,$3,$4)',
    '[$json.ctx.turnId,$json.payload.model,JSON.stringify($json.payload).length*3+256,2400]',
    220,
    0,
  );
  const warning = code(
    '예산 경고',
    "if ($json.warning) console.warn('월 모델 예약액이 80달러 이상입니다.'); return $input.all();",
    330,
    0,
  );
  const ai = http(
    'OpenAI 호출',
    'POST',
    'https://api.openai.com/v1/chat/completions',
    'openAiApi',
    "$('모델 요청').first().json.payload",
    440,
    0,
  );
  const settle = pg(
    '사용량 정산',
    'SELECT team_model_settle($1::uuid,$2,$3)',
    "[$('예산 예약').first().json.ticket,$json.usage.prompt_tokens ?? $json.usage.input_tokens,$json.usage.completion_tokens ?? $json.usage.output_tokens]",
    660,
    0,
  );
  const result = code(
    '모델 응답',
    "return [{json:{input:$('모델 요청').first().json,message:$('OpenAI 호출').first().json.choices[0].message}}];",
    880,
    0,
  );
  chain(start, reserve, warning, ai, settle, result);
  wf = flow('TeamDiscordGateway', 'Discord · 상품 포럼');
  const trigger = 'Discord 이벤트';
  wf.nodes.push({
    id: 'gateway',
    name: trigger,
    type: '@yuniruyuni/n8n-nodes-discord.discordTrigger',
    typeVersion: 1,
    position: [0, 0],
    parameters: {
      event: '*',
      autoCalculateIntents: false,
      intents: ['GUILDS', 'GUILD_MESSAGES', 'MESSAGE_CONTENT'],
      includeBotMessages: false,
      emitRawPayload: false,
    },
  });
  const filter = code(
    '서버와 이벤트',
    settingsNode +
      `const {event,data}= $json;
if (!data || data.guild_id!==settings.guild || !/^\\d{15,22}$/.test(data.channel_id) || !/^\\d{15,22}$/.test(data.id)) return [];
const message=event==='MESSAGE_CREATE';
if (message && (!data.content?.trim() || data.author?.bot || data.webhook_id || ![0,19].includes(data.type))) return [];
if(!message && (event!=='INTERACTION_CREATE'||![3,5].includes(data.type)||! /^(edit|approve|submit):[a-f0-9-]{36}$/.test(data.data?.custom_id))) return [];
if(!message && data.application_id!==settings.bot) return [];
return [{json:{event:data,message,settings}}];`,
    200,
    0,
  );
  const isMsg = test('메시지 여부', '$json.message', 400, 0);
  const channel = http(
    '포럼 글 확인',
    'GET',
    '=https://discord.com/api/v10/channels/{{ $json.event.channel_id }}',
    'discordBotApi',
    null,
    620,
    180,
  );
  const forum = code(
    '지정 포럼',
    `const v=$('서버와 이벤트').first().json;
return [10,11,12].includes($json.type)&&$json.parent_id===v.settings.forum ? [{json:{...v,channel:$json}}] : [];`,
    840,
    180,
  );
  const inbox = pg(
    '이벤트 접수',
    `WITH expired AS (DELETE FROM team_discord_event WHERE received_at < now()-interval '30 days')
INSERT INTO team_discord_event(event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id`,
    '[$json.event.id]',
    1060,
    180,
  );
  const state = pg(
    '현재 판본',
    'SELECT t.state,t.review_token AS token,t.title,t.body,t.issue_number,t.answer FROM (SELECT 1) s LEFT JOIN team_request t ON t.request_id=$1',
    "['discord:'+$('서버와 이벤트').first().json.event.channel_id]",
    1280,
    180,
  );
  const proceed = test(
    '대화 계속',
    "(!$json.state || $json.state==='answered') && $('서버와 이벤트').first().json.event.content.trim()!=='조회'",
    1500,
    180,
  );
  const history = http(
    '같은 글 대화',
    'GET',
    "=https://discord.com/api/v10/channels/{{ $('서버와 이벤트').first().json.event.channel_id }}/messages?limit=41&before={{ $('서버와 이벤트').first().json.event.id }}",
    'discordBotApi',
    null,
    1720,
    180,
    { response: { response: { fullResponse: true, responseFormat: 'json' } } },
  );
  const context = code(
    '대화 맥락',
    logic.conversation.toString() +
      `
const {event,settings,channel}=$('지정 포럼').first().json;
const history=$json.body;
if(history.length>40) return [{json:{text:'대화가 길어졌어요. 합의한 조건을 새 포럼 글에 정리해 주세요.'}}];
const ctx=conversation(history,event,channel,settings);
if(ctx.turns.some(m=>m.role==='assistant') && /^(알겠어요|알겠어|감사합니다|그렇군요|그렇구나)[.! ]*$/.test(ctx.command)) return [{json:{text:'추가로 궁금한 점이나 원하는 변경이 있으면 이어서 말씀해 주세요.'}}];
ctx.previous_token=$('현재 판본').first().json.token;
return [{json:{ctx}}];`,
    1940,
    180,
  );
  const lookup = test('상품 근거 필요', '!!$json.ctx', 2160, 180);
  const evidence = internal('상품 근거', 'TeamRequestEvidence', 2380, 180);
  const init = code(
    '질문 준비',
    modelFns +
      `const ctx=$('대화 맥락').first().json;
const basis=$json;
if (!basis.repo || !basis.index?.length || !/^[0-9a-f]{40}$/.test(basis.commit)) return [{json:{text:'최신 상품 근거를 확인할 수 없어 판단을 보류해요.'}}];
if(ctx.ctx.command==='명세') return [{json:{text:basis.index.map(d=>d.headings.join('\\n')+'\\n<https://github.com/'+basis.repo+'/blob/'+basis.commit+'/'+d.path+'>').join('\\n')}}];
return [{json:{next:modelInput(ctx.ctx,basis,skills,ctx.ctx.stage)}}];`,
    2600,
    180,
  );
  const next = test('모델 요청 여부', '!!$json.next', 2820, 180);
  const unwrap = code('모델 입력', 'return [{json:$json.next}];', 3040, 120);
  const predict = internal('예산 내 추론', 'TeamDiscordModel', 3260, 120);
  const decision = code(
    '후속 질문과 초안',
    modelFns +
      logic.decide.toString() +
      '\nreturn [{json:decide($json.input,$json.message,skills,' +
      JSON.stringify(template) +
      ')}];',
    3480,
    120,
  );
  const hasDraft = test('초안 보관 여부', '!!$json.draft', 3040, 360);
  const draft = code('초안 입력', 'return [{json:{body:$json.draft}}];', 3260, 360);
  const store = internal('초안 보관', 'TeamRequestDiscord', 3480, 360);
  const display = code(
    '판본 표시',
    logic.preview.toString() +
      "\nreturn preview($json,'SungKong00/ai-study-practice').map(payload=>({json:{payload}}));",
    3700,
    440,
  );
  const text = code(
    '답변 표시',
    `const parts=$json.text.match(/[\\s\\S]{1,1900}/gu)||[];return parts.map(content=>({json:{payload:{content}}}));`,
    3480,
    600,
  );
  const send = http(
    '같은 글에 답변',
    'POST',
    "=https://discord.com/api/v10/channels/{{ $('서버와 이벤트').first().json.event.channel_id }}/messages",
    'discordBotApi',
    'Object.assign({allowed_mentions: {parse: []} }, $json.payload)',
    3920,
    440,
  );
  const intScope = code(
    '버튼 포럼 확인',
    `const {event,settings}=$json;
return event.channel?.parent_id===settings.forum ? [{json:$json}] : [];`,
    620,
    -240,
  );
  const current = pg(
    '버튼 판본',
    'SELECT t.state,t.title,t.body,t.review_token AS token,t.issue_number FROM (SELECT 1) s LEFT JOIN team_request t ON t.request_id=$1',
    "['discord:'+$json.event.channel_id]",
    840,
    -240,
  );
  const button = code(
    '권한과 판본',
    logic.interaction.toString() +
      `\nconst v=$('서버와 이벤트').first().json;
return [{json:interaction(v.event,v.settings.role,$json)}];`,
    1060,
    -240,
  );
  const ack = http(
    '버튼 즉시 응답',
    'POST',
    "=https://discord.com/api/v10/interactions/{{ $('서버와 이벤트').first().json.event.id }}/{{ $('서버와 이벤트').first().json.event.token }}/callback",
    null,
    '$json.callback',
    1280,
    -240,
  );
  wf.nodes.at(-1).alwaysOutputData = true;
  const action = code(
    '승인한 요청',
    `const {review,show}=$('권한과 판본').first().json;
if(!review&&!show)return [];
return [{json:{body:{request_id:'discord:'+$('서버와 이벤트').first().json.event.channel_id,...(review||{action:'status'})}}}];`,
    1500,
    -240,
  );
  const review = internal('공통 검토', 'TeamRequestDiscord', 1720, -240);
  chain(trigger, filter, isMsg);
  edge(isMsg, channel);
  edge(isMsg, intScope, 1);
  chain(channel, forum, inbox, state, proceed);
  edge(proceed, history);
  edge(proceed, display, 1);
  chain(history, context, lookup);
  edge(lookup, evidence);
  edge(lookup, text, 1);
  chain(evidence, init, next);
  edge(next, unwrap);
  edge(next, hasDraft, 1);
  chain(unwrap, predict, decision, next);
  edge(hasDraft, draft);
  edge(hasDraft, text, 1);
  chain(draft, store, display, send);
  edge(text, send);
  chain(intScope, current, button, ack, action, review, display);
  // A failed lookup or budget reservation must stop before a draft is saved.
  const fallback = code(
    '조회 또는 모델 실패',
    "return [{json:{text:'상품 근거나 모델 응답을 확인하지 못했어요. 판정을 보류해요. 잠시 후 다시 질문해 주세요.'}}];",
    2820,
    700,
  );
  for (const name of [evidence, predict]) {
    wf.nodes.find((n) => n.name === name).onError = 'continueErrorOutput';
    edge(name, fallback, 1);
  }
  edge(fallback, text);
  const reviewError = code(
    '검토 상태 확인 안내',
    "return [{json:{text:'수정·승인 결과를 확인하지 못했어요. 조회를 입력해 현재 판본과 등록 상태를 확인해 주세요.'}}];",
    1940,
    -130,
  );
  wf.nodes.find((n) => n.name === review).onError = 'continueErrorOutput';
  edge(review, reviewError, 1);
  edge(reviewError, text);
  return [model, wf];
}
if (require.main === module) {
  const settings = {
    guild: process.env.DISCORD_GUILD_ID,
    forum: process.env.DISCORD_FORUM_ID,
    role: process.env.DISCORD_REVIEW_ROLE_ID,
    bot: process.env.DISCORD_APPLICATION_ID,
  };
  process.stdout.write(JSON.stringify(build(settings)));
}
module.exports = { build };
