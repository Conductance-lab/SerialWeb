import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Execute the application's functions without duplicating the timestamp logic.
function extractFunction(name) {
  const start = html.indexOf(`      function ${name}(`);
  assert.notEqual(start, -1, `Missing function: ${name}`);
  const end = html.indexOf('\n      }', start);
  assert.notEqual(end, -1, `Missing function end: ${name}`);
  return html.slice(start, end + '\n      }'.length);
}

const context = vm.createContext({
  MAX_CHART_POINTS: 10000,
  MAX_CHART_HISTORY_MS: 60000,
  nowPreciseMs: () => 100000,
  getParserSignature: () => '',
});
vm.runInContext([
  'normalizeTimestampMs',
  'pushNumericSeries',
  'estimateDerivedChartIntervalMs',
  'pushDerivedChartValues',
  'createDerivedRuntimeSeed',
].map(extractFunction).join('\n'), context);

function getPoints(mode, timestamps, values, bases) {
  const runtime = context.createDerivedRuntimeSeed(mode, 'realtime');
  Object.assign(runtime, bases);
  timestamps.forEach((timestamp, index) => {
    context.pushDerivedChartValues(runtime, { sample: values[index] }, timestamp, 'parsed');
  });
  return Array.from(runtime.numericSeries['parsed.sample'], ({ t, v }) => ({ t, v }));
}

test('binary parsed values keep distinct receive times', () => {
  assert.deepEqual(getPoints('binary', [100000, 101000, 102000], [0, 128, 255], {
    binaryBaseTimestamp: 100000,
  }), [{ t: 0, v: 0 }, { t: 1000, v: 128 }, { t: 2000, v: 255 }]);
});

test('text parsed values retain their text time base', () => {
  assert.deepEqual(getPoints('text', [200000, 200250], [1, 2], {
    textBaseTimestamp: 200000,
  }), [{ t: 0, v: 1 }, { t: 250, v: 2 }]);
});

test('parser mode selects the base when both clocks are present', () => {
  assert.deepEqual(getPoints('binary', [101000], [128], {
    binaryBaseTimestamp: 100000,
    textBaseTimestamp: 90000,
  }), [{ t: 1000, v: 128 }]);
});

test('frames from one receive chunk keep their shared arrival time', () => {
  assert.deepEqual(getPoints('binary', [101000, 101000], [0, 255], {
    binaryBaseTimestamp: 100000,
  }), [{ t: 1000, v: 0 }, { t: 1000, v: 255 }]);
});

test('binary timeline replay uses its own receive time base', () => {
  const runtime = context.createDerivedRuntimeSeed('binary', 'timeline');
  runtime.binaryBaseTimestamp = 500000;
  context.pushDerivedChartValues(runtime, { sample: 64 }, 500750, 'parsed');
  assert.equal(runtime.numericSeries['parsed.sample'][0].t, 750);
});
