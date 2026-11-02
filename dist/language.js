export const languages = {en:'English',hi:'हिन्दी',mr:'मराठी'};
export const normalizeLanguage = value => typeof value==='string'&&Object.hasOwn(languages,value) ? value : 'en';
// English source labels remain the stored values; only their presentation changes.
const rows = [
['Theme','थीम','थीम'],
['Light','हल्का','प्रकाशमय'],
['Dark','गहरा','गडद'],
['Language','भाषा','भाषा'],
['Skip to content','मुख्य सामग्री पर जाएँ','मुख्य मजकुराकडे जा'],
['Main navigation','मुख्य नेविगेशन','मुख्य नेव्हिगेशन'],
['BETTER EVERYDAY PLACES','बेहतर सार्वजनिक स्थान','अधिक चांगली सार्वजनिक ठिकाणे'],
['PILOT WORKSPACE','पायलट कार्यक्षेत्र','प्रायोगिक कार्यक्षेत्र'],
['Suvidha Map','सुविधा मानचित्र','सुविधा नकाशा'],
['My complaints','मेरी शिकायतें','माझ्या तक्रारी'],
['Government portal','सरकारी पोर्टल','शासकीय पोर्टल'],
['Analytics','विश्लेषण','विश्लेषण'],
['Field assessment','स्थल मूल्यांकन','स्थळ मूल्यांकन'],
['FROM EXISTENCE TO USABILITY','उपलब्धता से उपयोगिता तक','उपलब्धतेपासून उपयुक्ततेपर्यंत'],
['Public places.','सार्वजनिक स्थान।','सार्वजनिक ठिकाणे.'],
['People first.','नागरिक सबसे पहले।','नागरिकांना प्राधान्य.'],
['Know what works.','जानें कौन-सी सुविधा चालू है।','कोणती सुविधा कार्यरत आहे ते जाणून घ्या.'],
['Help improve what doesn’t.','खराब सुविधाओं को सुधारने में मदद करें।','बंद सुविधा सुधारण्यासाठी मदत करा.'],
['Demo workspace','डेमो कार्यक्षेत्र','प्रात्यक्षिक कार्यक्षेत्र'],
['Sample data · no sign-in','नमूना डेटा · साइन-इन नहीं','नमुना डेटा · साइन-इन नाही'],
['Citizen services','नागरिक सेवाएँ','नागरिक सेवा'],
['Foundation preview','प्रारंभिक पूर्वावलोकन','प्राथमिक पूर्वावलोकन'],
['JanSuvidha · Citizen-centric civic amenity assessment','जनसुविधा · नागरिक-केंद्रित सार्वजनिक सुविधा मूल्यांकन','जनसुविधा · नागरिक-केंद्रित सार्वजनिक सुविधा मूल्यांकन'],
['Prototype · Fictional facilities and wards','प्रोटोटाइप · काल्पनिक सुविधाएँ और वार्ड','प्रायोगिक आवृत्ती · काल्पनिक सुविधा आणि प्रभाग'],
['YOUR NEIGHBOURHOOD, BETTER UNDERSTOOD','अपने पड़ोस को बेहतर जानें','आपला परिसर अधिक चांगल्या प्रकारे जाणून घ्या'],
['Find a place that works for you.','अपने लिए उपयोगी सुविधा खोजें।','आपल्यासाठी उपयुक्त सुविधा शोधा.'],
['Explore civic amenities, see verified conditions, and help your community.','नागरिक सुविधाएँ खोजें, सत्यापित स्थिति देखें और अपने समुदाय की मदद करें।','नागरी सुविधा शोधा, पडताळलेली स्थिती पाहा आणि आपल्या समुदायाला मदत करा.'],
['Report a problem','समस्या की सूचना दें','समस्या नोंदवा'],
['Listed amenities','सूचीबद्ध सुविधाएँ','नोंदणीकृत सुविधा'],
['Across 2 sample wards','2 नमूना वार्डों में','2 नमुना प्रभागांमध्ये'],
['Verified usable','सत्यापित उपयोग योग्य','पडताळलेल्या वापरण्यायोग्य सुविधा'],
['Based on demo assessments','डेमो मूल्यांकन पर आधारित','प्रात्यक्षिक मूल्यांकनावर आधारित'],
['Needs attention','ध्यान देने की आवश्यकता','लक्ष देण्याची गरज'],
['Partly usable or not usable','आंशिक उपयोग योग्य या अनुपयोगी','अंशतः वापरण्यायोग्य किंवा वापरण्यायोग्य नाही'],
['Awaiting verification','सत्यापन की प्रतीक्षा','पडताळणीच्या प्रतीक्षेत'],
['Field assessment pending','स्थल मूल्यांकन लंबित','स्थळ मूल्यांकन प्रलंबित'],
['Search facilities or wards','सुविधाएँ या वार्ड खोजें','सुविधा किंवा प्रभाग शोधा'],
['⌕  Search an amenity or ward…','⌕  सुविधा या वार्ड खोजें…','⌕  सुविधा किंवा प्रभाग शोधा…'],
['Ward','वार्ड','प्रभाग'],
['All wards','सभी वार्ड','सर्व प्रभाग'],
['Ward 01','वार्ड 01','प्रभाग 01'],
['Ward 02','वार्ड 02','प्रभाग 02'],
['WARD 01','वार्ड 01','प्रभाग 01'],
['WARD 02','वार्ड 02','प्रभाग 02'],
['Usable only','केवल उपयोग योग्य','फक्त वापरण्यायोग्य'],
['Step-free access','बिना सीढ़ी का प्रवेश','पायऱ्यांशिवाय प्रवेश'],
['Amenity types','सुविधाओं के प्रकार','सुविधांचे प्रकार'],
['All amenities','सभी सुविधाएँ','सर्व सुविधा'],
['Public toilets','सार्वजनिक शौचालय','सार्वजनिक स्वच्छतागृहे'],
['Drinking water','पेयजल','पिण्याचे पाणी'],
['Parks','पार्क','उद्याने'],
['Bus stops','बस स्टॉप','बस थांबे'],
['Health centres','स्वास्थ्य केंद्र','आरोग्य केंद्रे'],
['Libraries','पुस्तकालय','वाचनालये'],
['Schematic sample ward map','नमूना वार्ड का सांकेतिक मानचित्र','नमुना प्रभागाचा सांकेतिक नकाशा'],
['⌖ Sample neighbourhood · schematic, not for navigation','⌖ नमूना पड़ोस · सांकेतिक, रास्ता खोजने के लिए नहीं','⌖ नमुना परिसर · सांकेतिक, मार्गदर्शनासाठी नाही'],
['Usable','उपयोग योग्य','वापरण्यायोग्य'],
['Partly usable','आंशिक उपयोग योग्य','अंशतः वापरण्यायोग्य'],
['Not usable','उपयोग योग्य नहीं','वापरण्यायोग्य नाही'],
['Unverified','असत्यापित','पडताळणी झालेली नाही'],
['Explore amenities','सुविधाएँ देखें','सुविधा पाहा'],
['Illustrative CAAUI score','उदाहरणात्मक CAAUI स्कोर','उदाहरणात्मक CAAUI गुण'],
['Not yet verified','अभी सत्यापित नहीं','अद्याप पडताळलेले नाही'],
['Not assessed','मूल्यांकन नहीं हुआ','मूल्यांकन झालेले नाही'],
['No matching amenities.','कोई सुविधा नहीं मिली।','जुळणारी सुविधा आढळली नाही.'],
['Try another filter or search.','अन्य फ़िल्टर या खोज आज़माएँ।','दुसरा फिल्टर किंवा शोध वापरा.'],
['A listing is only the beginning.','सूची में होना केवल शुरुआत है।','यादीतील नोंद ही केवळ सुरुवात आहे.'],
['Field assessments show whether a facility is actually accessible, available and usable.','स्थल मूल्यांकन बताते हैं कि सुविधा वास्तव में सुलभ, उपलब्ध और उपयोग योग्य है या नहीं।','स्थळ मूल्यांकनातून सुविधा प्रत्यक्षात सुलभ, उपलब्ध आणि वापरण्यायोग्य आहे का हे समजते.'],
['Explore the index ↗','सूचकांक देखें ↗','निर्देशांक पाहा ↗'],
['Central Garden Public Toilet','सेंट्रल गार्डन सार्वजनिक शौचालय','सेंट्रल गार्डन सार्वजनिक स्वच्छतागृह'],
['Market Road Drinking Water','मार्केट रोड पेयजल','मार्केट रोड पिण्याचे पाणी'],
['Riverside Community Park','रिवरसाइड सामुदायिक पार्क','रिव्हरसाइड सामुदायिक उद्यान'],
['Station Road Bus Shelter','स्टेशन रोड बस आश्रय','स्टेशन रोड बस निवारा'],
['North Ward Health Centre','उत्तरी वार्ड स्वास्थ्य केंद्र','उत्तर प्रभाग आरोग्य केंद्र'],
['Community Reading Room','सामुदायिक वाचनालय','सामुदायिक वाचनालय'],
['Close dialog','संवाद बंद करें','संवाद बंद करा'],
['Official record (sample)','आधिकारिक रिकॉर्ड (नमूना)','अधिकृत नोंद (नमुना)'],
['Listed · operational','सूचीबद्ध · कार्यरत','नोंदणीकृत · कार्यरत'],
['Field finding (sample)','स्थल निष्कर्ष (नमूना)','स्थळ निरीक्षण (नमुना)'],
['Last field assessment','पिछला स्थल मूल्यांकन','मागील स्थळ मूल्यांकन'],
['Opening hours','खुलने का समय','उघडण्याची वेळ'],
['Open 24 hours','24 घंटे खुला','24 तास खुले'],
['Assessment is over 90 days old and may be outdated.','मूल्यांकन 90 दिन से अधिक पुराना है और अप्रासंगिक हो सकता है।','मूल्यांकन 90 दिवसांपेक्षा जुने असून कालबाह्य असू शकते.'],
['Illustrative CAAUI','उदाहरणात्मक CAAUI','उदाहरणात्मक CAAUI'],
['Insufficient data','अपर्याप्त डेटा','अपुरा डेटा'],
['Equal weights for this demo only. Missing dimensions are excluded; these are not validated research scores.','केवल इस डेमो में समान भार हैं। अनुपलब्ध आयाम शामिल नहीं हैं; ये मान्य शोध स्कोर नहीं हैं।','फक्त या प्रात्यक्षिकात समान भार आहेत. उपलब्ध नसलेले घटक वगळले आहेत; हे प्रमाणित संशोधन गुण नाहीत.'],
['Provision','प्रावधान','तरतूद'],['Availability','उपलब्धता','उपलब्धता'],['Accessibility','सुगम्यता','सुलभता'],['Functionality','कार्यशीलता','कार्यक्षमता'],['Usability','उपयोगिता','उपयुक्तता'],['Safety','सुरक्षा','सुरक्षितता'],['Cleanliness','स्वच्छता','स्वच्छता'],['Affordability','वहनीयता','परवडणारी किंमत'],['Satisfaction','संतुष्टि','समाधान'],
['No field photos have been collected for these fictional facilities.','इन काल्पनिक सुविधाओं के स्थल फ़ोटो एकत्र नहीं किए गए हैं।','या काल्पनिक सुविधांचे स्थळ फोटो गोळा केलेले नाहीत.'],
['Share quick feedback','अपनी प्रतिक्रिया दें','आपला अभिप्राय द्या'],['Your rating','आपकी रेटिंग','आपले गुणांकन'],['Feedback','प्रतिक्रिया','अभिप्राय'],['Save demo feedback','डेमो प्रतिक्रिया सहेजें','प्रात्यक्षिक अभिप्राय जतन करा'],
['Feedback saved locally. Verified facility status stays unchanged.','प्रतिक्रिया इस डिवाइस पर सहेजी गई। सत्यापित स्थिति नहीं बदली है।','अभिप्राय या उपकरणावर जतन केला. पडताळलेली स्थिती बदललेली नाही.'],
['CITIZEN REPORTS','नागरिक रिपोर्ट','नागरिकांच्या तक्रारी'],
['A small report. A better public place.','एक छोटी रिपोर्ट। एक बेहतर सार्वजनिक स्थान।','एक छोटी तक्रार. अधिक चांगले सार्वजनिक ठिकाण.'],
['Track demo reports and help close the loop on civic issues.','डेमो रिपोर्ट की स्थिति देखें और नागरिक समस्याओं के समाधान में मदद करें।','प्रात्यक्षिक तक्रारींची स्थिती पाहा आणि नागरी समस्या सोडवण्यास मदत करा.'],
['New complaint','नई शिकायत','नवीन तक्रार'],
['Demo reports stay in this browser. They are not sent to any government department.','डेमो रिपोर्ट इसी ब्राउज़र में रहती हैं। इन्हें किसी सरकारी विभाग को नहीं भेजा जाता।','प्रात्यक्षिक तक्रारी याच ब्राउझरमध्ये राहतात. त्या कोणत्याही शासकीय विभागाला पाठवल्या जात नाहीत.'],
['Select a facility and tell us what needs attention.','सुविधा चुनें और समस्या बताएँ।','सुविधा निवडा आणि समस्या सांगा.'],
['Facility','सुविधा','सुविधा'],['Issue category','समस्या का प्रकार','समस्येचा प्रकार'],
['Not working','काम नहीं कर रहा','कार्यरत नाही'],['No water','पानी नहीं है','पाणी नाही'],['Unclean','गंदा','अस्वच्छ'],['Unsafe','असुरक्षित','असुरक्षित'],['Locked / inaccessible','बंद / पहुँच से बाहर','बंद / प्रवेश करता येत नाही'],['Overcharging','अधिक शुल्क','जास्त शुल्क'],['Damaged','क्षतिग्रस्त','नुकसान झालेले'],['Other','अन्य','इतर'],
['What happened?','क्या हुआ?','काय झाले?'],['Describe the issue (at least 10 characters)','समस्या बताएँ (कम से कम 10 अक्षर)','समस्या सांगा (किमान 10 अक्षरे)'],
['Submit demo complaint','डेमो शिकायत जमा करें','प्रात्यक्षिक तक्रार नोंदवा'],['Cancel','रद्द करें','रद्द करा'],
['Photo upload, GPS capture and OTP verification will be connected in a later build.','फ़ोटो अपलोड, GPS और OTP सत्यापन बाद के संस्करण में जोड़े जाएँगे।','फोटो अपलोड, GPS आणि OTP पडताळणी पुढील आवृत्तीत जोडली जाईल.'],
['Your demo complaints','आपकी डेमो शिकायतें','आपल्या प्रात्यक्षिक तक्रारी'],
['COMPLAINT','शिकायत','तक्रार'],['FACILITY / ISSUE','सुविधा / समस्या','सुविधा / समस्या'],['STATUS','स्थिति','स्थिती'],['SUBMITTED','जमा करने की तारीख','नोंदणीची तारीख'],['PRIORITY','प्राथमिकता','प्राधान्य'],['View','देखें','पाहा'],['Manage','प्रबंधित करें','व्यवस्थापन करा'],
['Submitted','जमा की गई','नोंदवलेली'],['Acknowledged','प्राप्ति स्वीकार','प्राप्ती मान्य'],['Assigned','सौंपी गई','सोपवलेली'],['In progress','कार्य प्रगति पर','काम सुरू आहे'],['Resolved','समाधान किया गया','निराकरण झाले'],['Closed','बंद','बंद'],['Rejected','अस्वीकृत','नाकारलेली'],
['Normal','सामान्य','सामान्य'],['High','उच्च','उच्च'],['Urgent','अत्यावश्यक','अत्यावश्यक'],['Unassigned','अभी नहीं सौंपी गई','अद्याप सोपवलेली नाही'],
['No complaints match this view.','इस दृश्य में कोई शिकायत नहीं है।','या दृश्यात जुळणारी तक्रार नाही.'],
['Please enter at least 10 non-space characters.','कृपया रिक्त स्थान छोड़कर कम से कम 10 अक्षर लिखें।','कृपया मोकळ्या जागा वगळून किमान 10 अक्षरे लिहा.'],
['Citizen demo report','नागरिक की डेमो रिपोर्ट','नागरिकांची प्रात्यक्षिक तक्रार'],
['Confirm resolution','समाधान की पुष्टि करें','निराकरणाची पुष्टी करा'],['Dispute and reopen','असहमति जताएँ और दोबारा खोलें','आक्षेप नोंदवा आणि पुन्हा उघडा'],
['Citizen confirmed resolution','नागरिक ने समाधान की पुष्टि की','नागरिकाने निराकरणाची पुष्टी केली'],['Citizen disputed resolution','नागरिक ने समाधान पर असहमति जताई','नागरिकाने निराकरणावर आक्षेप नोंदवला'],
['You can confirm or dispute a resolution when it is marked resolved.','समाधान होने पर आप उसकी पुष्टि कर सकते हैं या असहमति जता सकते हैं।','निराकरण झाल्यावर आपण त्याची पुष्टी करू शकता किंवा आक्षेप नोंदवू शकता.'],
['Storage is unavailable. This change lasts only for this session.','स्टोरेज उपलब्ध नहीं है। यह बदलाव केवल इस सत्र तक रहेगा।','साठवण उपलब्ध नाही. हा बदल फक्त या सत्रापुरता राहील.'],
];
export const translations = Object.fromEntries(rows.map(([en,hi,mr])=>[en,{hi,mr}]));
export function translate(text, language) {
  language=normalizeLanguage(language);
  if(language==='en')return text;
  const trimmed=text.trim(), entry=Object.hasOwn(translations,trimmed)?translations[trimmed]:null;
  if(entry)return text.replace(trimmed,entry[language]);
  if(/^\d+ facilities$/.test(trimmed))return trimmed.replace('facilities',language==='hi'?'सुविधाएँ':'सुविधा');
  const saved=trimmed.match(/^Demo complaint (JS-[\w-]+) saved\.$/);
  if(saved)return language==='hi'?`डेमो शिकायत ${saved[1]} सहेजी गई।`:`प्रात्यक्षिक तक्रार ${saved[1]} जतन केली.`;
  // Composed labels keep IDs, scores and punctuation intact.
  if(text.includes(' · ')||text.includes(': '))return text.split(/( · |: )/).map(part=>part===' · '||part===': '?part:translate(part,language)).join('');
  if(trimmed.startsWith('＋ '))return text.replace(trimmed,`＋ ${translate(trimmed.slice(2),language)}`);
  return text;
}

const sources=new WeakMap();
export function localize(root,language){
  const remember=(node,key,value)=>{
    let entries=sources.get(node);if(!entries){entries={};sources.set(node,entries)}
    const previous=entries[key];
    const source=previous&&previous.result===value?previous.source:value;
    const result=translate(source,language);entries[key]={source,result};return result;
  };
  // Keep option values stable even when their visible labels change.
  root.querySelectorAll('option:not([value])').forEach(option=>option.value=option.textContent);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.parentElement.closest('[translate="no"],script,style,textarea'))node.textContent=remember(node,'text',node.textContent);
  }
  root.querySelectorAll('[aria-label],[placeholder]').forEach(element=>{
    if(element.closest('[translate="no"]'))return;
    for(const attr of ['aria-label','placeholder'])if(element.hasAttribute(attr))element.setAttribute(attr,remember(element,attr,element.getAttribute(attr)));
  });
  root.querySelectorAll('time[datetime]').forEach(element=>element.textContent=new Date(element.dateTime).toLocaleDateString(`${language}-IN`,{day:'numeric',month:'short',year:'numeric'}));
}
