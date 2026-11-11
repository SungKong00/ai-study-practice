const path = require('node:path');

const directory = path.resolve(path.dirname(require.resolve('@log4brains/web')), '../nextjs');
process.env.LOG4BRAINS_PHASE = 'initial-build';
process.env.NEXT_TELEMETRY_DISABLED = '1';
const config = require(path.join(directory, 'next.config.js'));
// 배포용 Log4brains build와 같은 타입 검사 정책으로 패키지의 웹 빌드만 재생성한다.
require('next/dist/build').default(directory, {
  ...config,
  typescript: { ...config.typescript, ignoreBuildErrors: true }
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
