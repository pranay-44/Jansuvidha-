import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {score,filterFacilities,facilities} from '../dist/data.js';
import {languages,normalizeLanguage,translate,translations} from '../dist/language.js';
assert.equal(score([]),null);
assert.equal(score([100,null,undefined,0]),50);
assert.equal(filterFacilities({ward:'Ward unknown'}).length,facilities.filter(f=>!f.ward).length);
assert.equal(filterFacilities({query:'NONEXISTENT'}).length,0);
assert.ok(filterFacilities({accessible:true}).every(f=>f.accessible));
assert.equal(new Set(facilities.map(f=>f.id)).size,facilities.length);
console.log('Passed: missing scores, averages, combined filters, empty results, accessibility, unique facility IDs.');
assert.deepEqual(Object.keys(languages),['en','hi','mr']);
for(const invalid of ['fr','constructor','__proto__',null,{},[],['hi']])assert.equal(normalizeLanguage(invalid),'en');
for(const [source,labels] of Object.entries(translations)){
  assert.equal(translate(source,'en'),source);
  for(const language of ['hi','mr'])assert.equal(translate(source,language),labels[language]);
}
assert.equal(translate('Public toilets · Ward 01','hi'),'सार्वजनिक शौचालय · वार्ड 01');
assert.equal(translate('Central Garden Public Toilet: Usable','mr'),'सेंट्रल गार्डन सार्वजनिक स्वच्छतागृह: वापरण्यायोग्य');
assert.equal(translate('＋ New complaint','hi'),'＋ नई शिकायत');
assert.equal(translate('0 facilities','mr'),'0 सुविधा');
assert.equal(translate('Demo complaint JS-12345678 saved.','hi'),'डेमो शिकायत JS-12345678 सहेजी गई।');
assert.equal(translate('Unrecognised text','hi'),'Unrecognised text');
assert.equal(translate('constructor','hi'),'constructor');
console.log('Passed: supported languages, invalid preference fallback, translation coverage, composed labels and dynamic messages.');
const themeScript=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
for(const [stored,expected] of [[null,'light'],['"dark"','dark'],['"light"','light'],['"invalid"','light'],['broken JSON','light'],['{}','light']]){
  const document={documentElement:{dataset:{}}};
  runInNewContext(themeScript,{document,localStorage:{getItem:()=>stored}});
  assert.equal(document.documentElement.dataset.theme,expected);
}
const document={documentElement:{dataset:{}}};
runInNewContext(themeScript,{document,localStorage:{getItem(){throw Error('Storage blocked')}}});
assert.equal(document.documentElement.dataset.theme,'light');
console.log('Passed: saved theme restoration, default theme, invalid preferences and blocked storage.');

// Run the actual amenity handler without touching a user's stored reviews.
const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const detailSource=appSource.slice(appSource.indexOf('function facilityDetail('),appSource.indexOf('function analytics('));
const elements={'#report-link':{},'#rating-form':{},'#amenity-reviews':{scrollIntoView(){}}};
let card='',closed=false,saved=[],message='';
const ratings=[];
const ctx={facilities,ratings,Date,Number,String,
  $:s=>elements[s],
  esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  show:html=>{card=html;},photoUrl:p=>p,options:a=>a.join(''),date:s=>s,refreshLanguage(){},
  dialog:{close(){closed=true;}},toast:s=>{message=s;},
  save:(_key,data)=>{saved=JSON.parse(JSON.stringify(data));return true;},
  FormData:class{constructor(form){this.form=form;}get(key){return this.form[key];}}
};
runInNewContext(detailSource+';globalThis.openDetail=facilityDetail;',ctx);
const first=facilities[0].id,second=facilities[1].id;
ctx.openDetail(first);
assert.match(card,/Report a problem/);
assert.doesNotMatch(card,/CAAUI|Source record|Last field assessment|Review notes/);
const submit=(feedback,rating='5')=>elements['#rating-form'].onsubmit({preventDefault(){},target:{feedback,rating,reset(){}}});
submit('   ');submit('Invalid rating','6');
assert.equal(ratings.length,0);
submit('<img src=x onerror=alert(1)>');
assert.equal(closed,false);
assert.match(elements['#amenity-reviews'].innerHTML,/&lt;img/);
assert.doesNotMatch(elements['#amenity-reviews'].innerHTML,/<img/);
assert.equal(saved.length,1);
submit('Newest review','4');
assert.ok(elements['#amenity-reviews'].innerHTML.indexOf('Newest review')<elements['#amenity-reviews'].innerHTML.indexOf('&lt;img'));
ctx.openDetail(second);
assert.match(elements['#amenity-reviews'].innerHTML,/No reviews yet/);
ratings.splice(0,ratings.length,...saved);
ctx.openDetail(first);
assert.match(elements['#amenity-reviews'].innerHTML,/Newest review/);
ctx.save=()=>{message='Storage unavailable';return false;};
submit('Session review');
assert.equal(message,'Storage unavailable');
assert.match(elements['#amenity-reviews'].innerHTML,/Session review/);
assert.ok(facilities.filter(f=>!f.id.includes('-N19-')&&f.type!=='Bus stops').every(f=>f.status==='verified'&&f.verified==='2026-11-15'&&f.verification_source.includes('Project owner')));
assert.ok(facilities.filter(f=>f.id.includes('-N19-')).every(f=>f.status==='unverified'&&f.verified===null));
console.log('Passed: verified amenities, immediate reviews, isolation, restored reviews, safe text, invalid feedback and storage failure.');
