const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const path=require('path');
const root=fs.existsSync(path.resolve(__dirname,'../src'))?path.resolve(__dirname,'..'):'C:/Users/stefa/OneDrive/Desktop/DeuceIQ/frontend';
const ts=require(root+'/node_modules/typescript');
function load(file,mocks={}){const exports={};const source=ts.transpileModule(fs.readFileSync(root+'/src/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(source,{exports,require:n=>mocks[n]??{},Date,Intl,Set,Map,console});return exports;}
const {validateClinicSlots}=load('lib/recurringClinicSlots.ts');
const slot=(days,start='09:00',end='10:30')=>({days,start,end});
assert.equal(validateClinicSlots([slot(['MO','WE','FR'])],'2027-01-01','2027-06-01')[0].duration_minutes,90);
assert.equal(validateClinicSlots([slot(['MO']),slot(['MO'],'11:00','12:00')],'2027-01-01','2027-06-01').length,2);
assert.equal(validateClinicSlots([slot(['MO']),slot(['TU'])],'2027-01-01','2027-06-01').length,2);
assert.throws(()=>validateClinicSlots([slot(['MO']),slot(['MO'],'10:00','11:00')],'2027-01-01','2027-06-01'),/overlap/);
assert.throws(()=>validateClinicSlots([slot([])],'2027-01-01','2027-06-01'),/weekday/);
assert.throws(()=>validateClinicSlots([slot(['MO'],'12:00','11:00')],'2027-01-01','2027-06-01'),/finish/);
assert.throws(()=>validateClinicSlots([slot(['MO'])],'2027-01-01','2027-01-02'),/no matching/);
assert.throws(()=>validateClinicSlots([slot(['MO'],'25:00','26:00')],'2027-01-01','2027-06-01'),/valid local/);
assert.equal(validateClinicSlots([slot(['MO']),slot(['MO'],'10:30','11:30')],'2027-01-01','2027-06-01').length,2);
assert.throws(()=>validateClinicSlots(Array(7).fill(slot(['MO'])),'2027-01-01','2027-06-01'),/six/);
const {groupClinicSchedules}=load('components/ClinicSchedule.tsx');
const morning={id:'one',name:'Adult Clinic',clinic_type:'Adult Clinic',location_name:'Hither Hills',timezone:'America/New_York',starts_on:'2027-01-01',ends_on:'2027-06-01',start_time:'09:00',duration_minutes:90,published:true,sessions:[{id:'morning',starts_at:'2027-01-04T14:00:00Z',ends_at:'2027-01-04T15:30:00Z'}]};
const afternoon={...morning,id:'two',start_time:'13:00',sessions:[{id:'afternoon',starts_at:'2027-01-04T18:00:00Z',ends_at:'2027-01-04T19:30:00Z'}]};
const grouped=groupClinicSchedules([afternoon,morning]);
assert.equal(grouped.length,1);assert.equal(grouped[0].sessions.length,2);assert.equal(grouped[0].sessions[0].id,'morning');
assert.equal(groupClinicSchedules([morning,{...afternoon,location_name:'Other club court'}]).length,2);
assert.equal(groupClinicSchedules([morning,{...afternoon,published:false}])[0].published,false);
assert.equal(groupClinicSchedules([morning,{...afternoon,ends_on:'2027-07-01'}]).length,2);
let hooks=[],index=0;const react={useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v];},useRef:v=>{const i=index++;if(!(i in hooks))hooks[i]={current:v};return hooks[i];},useEffect:()=>{}};
const jsx=(type,props)=>({type,props});
const {ClinicDates}=load('components/ClinicDates.tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'../lib/supabase':{supabase:{}}});
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
async function scenario(staffView,sessions,chooseTime){hooks=[];let calls=[];const props={staffView,program:{name:'Adult Clinic',timezone:'America/New_York',sessions},clubId:'club',userId:'user',onClose:()=>{},onRegister:async id=>calls.push(id)};const render=()=>{index=0;return ClinicDates(props);};let tree=render();const date=nodes(tree).find(n=>n.props?.['aria-label']==='2027-01-04, clinic sessions available');assert.ok(date);date.props.onClick();await Promise.resolve();if(chooseTime){tree=render();assert.equal(calls.length,0);const choices=nodes(tree).filter(n=>n.props?.className==='clinic-session-choice');assert.equal(choices.length,2);choices[1].props.onClick();await Promise.resolve();}return calls;}
(async()=>{const a={id:'morning',starts_at:'2027-01-04T14:00:00Z',ends_at:'2027-01-04T15:30:00Z'},b={id:'afternoon',starts_at:'2027-01-04T18:00:00Z',ends_at:'2027-01-04T19:30:00Z'};assert.deepEqual(await scenario(true,[a],false),['morning']);assert.deepEqual(await scenario(false,[a],false),[]);assert.deepEqual(await scenario(true,[a,b],true),['afternoon']);console.log('10 scheduling checks, 4 grouped-calendar checks and 3 date workflow checks passed');})();
