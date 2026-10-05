const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const root = require('path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
let effects = [], states = [], index = 0;
const react = {
  useEffect: callback => effects.push(callback),
  useRef: value => { const i = index++; return states[i] ??= { current: value }; },
  useState: initial => { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => states[i] = typeof value === 'function' ? value(states[i]) : value]; },
};
const jsx = (type, props) => ({ type, props });
let listeners = {}, modalOpen = false, changed = [], created = [], date;
const documentMock = { body: { style: { overflow: 'auto' } }, querySelector: () => modalOpen ? {} : null };
const windowMock = { innerWidth: 1440, addEventListener: (name, callback) => listeners[name] = callback, removeEventListener: name => delete listeners[name] };
const exportsObject = {};
const source = ts.transpileModule(fs.readFileSync(root + '/src/components/CalendarBoard.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(source, { exports: exportsObject, Date, Intl, Set, Map, document: documentMock, window: windowMock,
  require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === 'react-dom' ? { createPortal: value => value } : {},
});
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const props = { fullView: true, onFullViewChange: value => changed.push(value), onCreate: () => created.push('button'), fullViewControls: jsx('select', { 'aria-label': 'Calendar location' }),
  bookings: [], courts: [{ id: 'court', name: 'Court 1', location_id: 'location' }], loading: false, error: null,
  calendarDate: '2026-10-05', setCalendarDate: value => date = value, timeZone: 'America/New_York', canEdit: true,
  clubId: 'club', locationId: 'location', userId: 'user', apiBase: 'https://example.invalid', onUpdated: () => {}, onOpenRequests: () => {}, onCreateRange: (...args) => created.push(args) };
function render(extra = {}) { index = 0; effects = []; return exportsObject.default({ ...props, ...extra }); }
let tree = render(), all = nodes(tree);
assert.equal(tree.props['aria-label'], 'Calendar full view');
const toggle = all.find(n => n.props?.className === 'calendar-full-view-toggle');
assert.equal(toggle.props.children, 'Exit full view'); toggle.props.onClick(); assert.equal(changed.pop(), false);
all.find(n => n.type === 'button' && n.props.children === '+ Create Booking').props.onClick(); assert.equal(created.pop(), 'button');
assert.ok(all.find(n => n.props?.['aria-label'] === 'Calendar location'));
all.find(n => n.props?.['aria-label'] === 'Next day').props.onClick(); assert.equal(date, '2026-10-06');
const grid = all.find(n => n.props?.className === 'calendar-board-columns'); assert.equal(grid.props.style.width, '100%');
const lane = all.find(n => n.props?.className === 'calendar-lane');
const event = { pointerType: 'mouse', button: 0, clientY: 96, pointerId: 1, target: { classList: { contains: () => true } }, currentTarget: { getBoundingClientRect: () => ({ top: 0 }), setPointerCapture: () => {}, hasPointerCapture: () => false }, preventDefault: () => {} };
lane.props.onPointerDown(event); lane.props.onPointerUp(event);
assert.equal(created[0][0], 'court'); assert.equal(created[0][1], '2026-10-05T07:00'); assert.equal(created[0][2], '2026-10-05T07:30');
tree = render(); const cleanup = effects[0](); assert.equal(documentMock.body.style.overflow, 'hidden');
modalOpen = true; listeners.keydown({ key: 'Escape' }); assert.equal(changed.length, 0);
modalOpen = false; listeners.keydown({ key: 'Escape' }); assert.equal(changed.pop(), false);
windowMock.innerWidth = 600; listeners.resize(); assert.equal(changed.pop(), false);
cleanup(); assert.equal(documentMock.body.style.overflow, 'auto'); assert.equal(Object.keys(listeners).length, 0);
states = []; all = nodes(render({ canEdit: false })); assert.ok(!all.some(n => n.type === 'button' && n.props.children === '+ Create Booking'));
states = []; tree = render({ fullView: false }); assert.equal(tree.props['aria-label'], 'Daily calendar');
console.log('Full-view creation, drag selection, date navigation, permissions, Escape, resizing and cleanup checks passed');
