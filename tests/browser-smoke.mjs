
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = process.cwd();
const delay = ms => new Promise(r=>setTimeout(r,ms));
let eventHandler = () => {};
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const profile = await mkdtemp(join(tmpdir(), 'focusup-browser-'));
const browser = spawn(process.env.FOCUSUP_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
'--remote-debugging-port=0','--user-data-dir='+profile,'--disable-extensions-except='+root,'--load-extension='+root,'about:blank'
], {windowsHide:true,stdio:'ignore'});
let ws;
try {
let info;
for(let i=0;i<80;i++){
 try {const port=(await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]; info=await (await fetch('http://127.0.0.1:'+port+'/json/version')).json();break;}catch{}
 await new Promise(r=>setTimeout(r,250));
}
assert.ok(info,'Browser debugging endpoint unavailable');
ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let sequence=0;const pending=new Map();
ws.onmessage=e=>{const msg=JSON.parse(e.data);if(!msg.id)eventHandler(msg);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}};
function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));setTimeout(()=>{if(pending.delete(id))reject(new Error('Timeout '+method));},10000).unref();});}
let worker;
for(let i=0;i<40;i++){const {targetInfos}=await call('Target.getTargets');worker=targetInfos.find(t=>t.type==='service_worker'&&t.url.includes('/src/background.js'));if(worker)break;await new Promise(r=>setTimeout(r,250));}
assert.ok(worker,'Extension service worker did not load');
const {sessionId: workerSession}=await call('Target.attachToTarget',{targetId:worker.targetId,flatten:true});
const extension = worker.url.split("/").slice(0, 3).join("/");
const {targetId: popupId}=await call('Target.createTarget',{url:extension+'/popup/popup.html'});
const {sessionId: popup}=await call('Target.attachToTarget',{targetId:popupId,flatten:true});
async function evaluate(session,expression){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
for(let i=0;i<40;i++){if(await evaluate(popup,"document.querySelector('#status')?.textContent.includes('Your settings are applied')"))break;await new Promise(r=>setTimeout(r,100));}
async function settings(action,values={}){const result=await evaluate(popup,'chrome.runtime.sendMessage('+JSON.stringify({type:'focusup-settings',action,...values})+')');assert.equal(result.ok,true,JSON.stringify(result));return result.settings;}
await settings('mode',{profileId:'focus'});
await settings('add',{profileId:'focus',domain:'example.com'});
const rules=await evaluate(workerSession,'chrome.declarativeNetRequest.getDynamicRules()');
assert.deepEqual(rules[0].condition.requestDomains,['example.com']);
async function navigate(url){
 const {targetId}=await call('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
 await call('Page.enable',{},sessionId);
 await call('Page.navigate',{url},sessionId);
 let location='';
 for(let i=0;i<60;i++){location=await evaluate(sessionId,'location.href');if(location.includes('/blocked/blocked.html'))break;await new Promise(r=>setTimeout(r,100));}
 return {sessionId,location};
}
for(const domain of ['example.com','www.example.com']){
 const page=await navigate('https://'+domain);
 assert.ok(page.location.includes('/blocked/blocked.html'),page.location);
 await new Promise(r=>setTimeout(r,500)); assert.match(await evaluate(page.sessionId,"document.querySelector('#reason').textContent"),/Focus Mode/);
}
await settings('mode',{profileId:'personal'});
assert.deepEqual(await evaluate(workerSession,'chrome.declarativeNetRequest.getDynamicRules()'),[]);
await settings('add',{profileId:'personal',domain:'other.com'});
await settings('mode',{profileId:'focus'});
assert.deepEqual((await settings('get')).blockedDomains,{focus:['example.com'],personal:['other.com']});
await settings('remove',{profileId:'focus',domain:'example.com'});
assert.deepEqual(await evaluate(workerSession,'chrome.declarativeNetRequest.getDynamicRules()'),[]);

// Exercise the real extension adapter on controlled YouTube DOM responses.
const fixture = '<!doctype html><html><body><ytd-app><ytd-watch-flexy video-id="one"><ytd-watch-metadata><div id="owner"><ytd-channel-name><a href="/@study">Study</a></ytd-channel-name></div></ytd-watch-metadata></ytd-watch-flexy><div id="related">Related</div><video></video></ytd-app></body></html>';
const {targetId: ytId} = await call('Target.createTarget',{url:'about:blank'});
const {sessionId: yt} = await call('Target.attachToTarget',{targetId:ytId,flatten:true});
eventHandler = msg => {
 if(msg.method==='Fetch.requestPaused') call('Fetch.fulfillRequest',{requestId:msg.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(fixture).toString('base64')},msg.sessionId).catch(console.error);
};
await call('Fetch.enable',{patterns:[{urlPattern:'https://www.youtube.com/*',resourceType:'Document',requestStage:'Request'}]},yt);
await call('Page.navigate',{url:'https://www.youtube.com/watch?v=one'},yt);
await delay(1000);
async function config(values) {
 await settings('youtube',{profileId:'focus',config:values});
 await delay(700);
}
const reason = () => evaluate(yt,"document.querySelector('#focusup-reason')?.textContent || ''");
await config({hideRelated:true});
assert.equal(await evaluate(yt,"getComputedStyle(document.querySelector('#related')).display"),'none');
await config({strictChannels:true,allowedChannels:['@study']});
assert.equal(await reason(),'');
await config({strictChannels:true,allowedChannels:['@other']});
assert.match(await reason(),/allowed channels/);
await config({blockedChannels:['@study']});
assert.match(await reason(),/channel is blocked/);
await settings('mode',{profileId:'personal'});await delay(700);
assert.equal(await reason(),'');
await settings('mode',{profileId:'focus'});
await config({allowSearch:false});
await evaluate(yt,"history.pushState({},'', '/results?search_query=test')");
await delay(700);assert.match(await reason(),/Search/);
await config({allowSubscriptions:false});
await evaluate(yt,"history.pushState({},'', '/feed/subscriptions')");
await delay(700);assert.match(await reason(),/Subscriptions/);
await config({shorts:'first'});
await evaluate(yt,"history.pushState({},'', '/shorts/first')");
await delay(700);assert.equal(await reason(),'');
await evaluate(yt,"history.pushState({},'', '/shorts/second')");
await delay(700);assert.match(await reason(),/first Short/);
await config({shorts:'block'});assert.match(await reason(),/Shorts are blocked/);
await config({shorts:'allow'});assert.equal(await reason(),'');
await config({allowVideos:false});assert.match(await reason(),/Watching videos/);
await config({hideHome:true});
await evaluate(yt,"history.pushState({},'', '/')");await delay(700);assert.equal(await evaluate(yt,"document.documentElement.classList.contains('focusup-home')"),true);assert.equal(await reason(),'');
await config({});
assert.equal(await reason(),'');
// Settings form saves to only the selected profile.
const {targetId: settingsId} = await call('Target.createTarget',{url:extension+'/settings/youtube.html'});
const {sessionId: settingsPage} = await call('Target.attachToTarget',{targetId:settingsId,flatten:true});
await delay(700);
assert.equal(await evaluate(settingsPage,"document.querySelector('#status').textContent"),'Focus Mode settings loaded.');
await evaluate(settingsPage,"document.querySelector('[name=hideRelated]').checked=true;document.querySelector('#config').requestSubmit()");
await delay(700);
assert.match(await evaluate(settingsPage,"document.querySelector('#status').textContent"),/have been saved/);
assert.equal((await settings('get')).youtube.focus.hideRelated,true);
assert.equal((await settings('get')).youtube.personal.hideRelated,false);
console.log('PASS: browser adapter fixtures: recommendation CSS, channels, unknown-channel policy, SPA routes, live mode changes, Shorts first/all/off, search, subscriptions, video pages, Home and settings form persistence.');

console.log('PASS: Edge loaded extension; popup initialized; real DNR redirects root/subdomain; explanation rendered; mode isolation and removal verified.');

if (process.argv.includes('--live')) {
const {targetId: liveId} = await call('Target.createTarget',{url:'https://www.youtube.com/watch?v=jNQXAC9IVRw'});
const {sessionId: live} = await call('Target.attachToTarget',{targetId:liveId,flatten:true});
await delay(12000);
const report = await evaluate(live,"({title:document.title,ownerLinks:document.querySelectorAll('#owner ytd-channel-name a').length,app:!!document.querySelector('ytd-app'),text:document.body.innerText.slice(0,300)})");
console.log('LIVE YouTube:',JSON.stringify(report));
if(report.app) {
 await config({allowVideos:false});
 await delay(700);
 assert.match(await evaluate(live,"document.querySelector('#focusup-reason')?.textContent || ''"),/Watching videos/);
 
await call('Page.reload',{},live);await delay(4000);
assert.match(await evaluate(live,"document.querySelector('#focusup-reason')?.textContent || ''"),/Watching videos/);
const owner = await evaluate(live,"document.querySelector('#owner ytd-channel-name a')?.href");
assert.ok(owner,'Live creator link available');
await config({strictChannels:true,allowedChannels:[owner]});
await delay(700);
assert.equal(await evaluate(live,"document.querySelector('#focusup-reason')?.textContent || ''"),'');
await config({blockedChannels:[owner]});await delay(700);
assert.match(await evaluate(live,"document.querySelector('#focusup-reason')?.textContent || ''"),/channel is blocked/);
console.log('PASS: live YouTube page gate, reload persistence, creator allowlist and blocklist.');

}
}

await call('Browser.close');
} finally {if(ws)ws.close();browser.kill();}
