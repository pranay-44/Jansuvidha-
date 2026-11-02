import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {score,filterFacilities,facilities} from './dist/data.js';
import {languages,normalizeLanguage,translate,translations} from './dist/language.js';
assert.equal(score([]),null);
assert.equal(score([100,null,undefined,0]),50);
assert.equal(filterFacilities({ward:'Ward 01',usable:true}).length,1);
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
const themeScript=readFileSync(new URL('./dist/theme.js',import.meta.url),'utf8');
for(const [stored,expected] of [[null,'light'],['"dark"','dark'],['"light"','light'],['"invalid"','light'],['broken JSON','light'],['{}','light']]){
  const document={documentElement:{dataset:{}}};
  runInNewContext(themeScript,{document,localStorage:{getItem:()=>stored}});
  assert.equal(document.documentElement.dataset.theme,expected);
}
const document={documentElement:{dataset:{}}};
runInNewContext(themeScript,{document,localStorage:{getItem(){throw Error('Storage blocked')}}});
assert.equal(document.documentElement.dataset.theme,'light');
console.log('Passed: saved theme restoration, default theme, invalid preferences and blocked storage.');
