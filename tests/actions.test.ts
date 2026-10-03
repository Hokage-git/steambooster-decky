import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageUrl, safeNavigation } from '../src/actions.ts';
import { DeckyRelay } from '../src/relay.ts';

test('known pages preserve original tracking routes', () => {
  assert.equal(pageUrl('catalog'), 'https://steambalance.cc/c/e6c5');
  assert.equal(pageUrl('valuation'), 'https://steambalance.cc/c/3f4d');
  assert.throws(() => pageUrl('eval'));
});
test('navigation permits HTTPS payment redirects and rejects unsafe URLs', () => {
  assert.ok(safeNavigation('https://example.com/pay'));
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://x:y@example.com', 'https://example.com:8080']) assert.equal(safeNavigation(url), false);
});
function fixture() {
  const sent: unknown[] = [], shown: string[] = [];
  let removed = 0;
  const relay = new DeckyRelay('secret', {
    post: (data) => sent.push(data),
    create: () => ({ destroy: () => { removed++; }, send: () => {}, node: null }),
    show: (id) => shown.push(id),
    hide: () => {}, navigate: () => {}, changed: () => {},
  });
  return { relay, sent, shown, removed: () => removed };
}
test('relay rejects a message with wrong secret', async () => {
  const {relay, sent} = fixture();
  await relay.receive({kind:'attach-popup', popupId:'a', requestId:1, html:'ok', __sbsec:'wrong'});
  assert.equal(relay.windows.size, 0);
  assert.equal(sent.length, 0);
});
test('popup loads before attach acknowledgement, shows and unloads', async () => {
  const {relay, sent, shown, removed} = fixture();
  await relay.receive({kind:'attach-popup', popupId:'a', requestId:1, html:'ok', __sbsec:'secret'});
  assert.equal((sent[0] as any).kind, 'popup-attached');
  await relay.receive({kind:'popup-show', popupId:'a', __sbsec:'secret'});
  assert.deepEqual(shown, ['a']);
  assert.equal((sent[1] as any).kind, 'popup-show-event');
  relay.close();
  assert.equal(relay.windows.size, 0);
  assert.equal(removed(), 1);
});
test('external window rejects malformed navigation', async () => {
  const {relay, sent} = fixture();
  await relay.receive({kind:'external-window-open', id:'a', requestId:1, url:'javascript:alert(1)', __sbsec:'secret'});
  assert.equal((sent[0] as any).ok, false);
});
test('window message keeps isolated frame target', async () => {
  const {relay, sent} = fixture();
  await relay.receive({kind:'open-window', windowId:'a', requestId:1, url:'https://steambalance.cc/booster/orders', title:'Orders', __sbsec:'secret'});
  assert.equal((sent[0] as any).kind, 'window-opened');
  assert.equal(relay.windows.get('a')?.url, 'https://steambalance.cc/booster/orders');
});
test('payment windows request native browser navigation', async () => {
  const {relay, sent, shown} = fixture();
  await relay.receive({kind:'external-window-open', id:'payment', requestId:5, url:'https://bank.example/pay', __sbsec:'secret'});
  assert.equal(relay.windows.get('payment')?.external, true);
  assert.equal((sent[0] as any).ok, true);
  assert.deepEqual(shown, ['payment']);
});
test('popup dimensions survive relay registration for native layout',async()=>{
 const {relay}=fixture();
 await relay.receive({kind:'attach-popup',popupId:'topup',html:'form',width:378,height:322,__sbsec:'secret'});
 assert.equal(relay.windows.get('topup')?.width,378);
 assert.equal(relay.windows.get('topup')?.height,322);
 relay.close();
});
