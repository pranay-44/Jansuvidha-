export const dimensions = ['Provision','Availability','Accessibility','Functionality','Usability','Safety','Cleanliness','Affordability','Satisfaction'];
export const facilities = [
 {id:'F001',name:'Central Garden Public Toilet',type:'Public toilets',ward:'Ward 01',status:'usable',verified:'2026-10-25',hours:'06:00 – 22:00',accessible:true,water:true,free:true,x:30,y:30,scores:[85,90,75,90,80,75,85,100,76]},
 {id:'F002',name:'Market Road Drinking Water',type:'Drinking water',ward:'Ward 01',status:'partial',verified:'2026-10-22',hours:'Open 24 hours',accessible:true,water:true,free:true,x:57,y:44,scores:[85,65,80,60,55,70,50,100,54]},
 {id:'F003',name:'Riverside Community Park',type:'Parks',ward:'Ward 02',status:'usable',verified:'2026-10-20',hours:'05:00 – 21:00',accessible:true,water:true,free:true,x:69,y:72,scores:[90,90,85,95,85,80,90,100,86]},
 {id:'F004',name:'Station Road Bus Shelter',type:'Bus stops',ward:'Ward 02',status:'unusable',verified:'2026-10-18',hours:'Open 24 hours',accessible:false,water:false,free:true,x:42,y:65,scores:[80,30,20,10,20,35,30,100,22]},
 {id:'F005',name:'North Ward Health Centre',type:'Health centres',ward:'Ward 01',status:'unverified',verified:null,hours:'Not yet verified',accessible:false,water:false,free:false,x:68,y:20,scores:[]},
 {id:'F006',name:'Community Reading Room',type:'Libraries',ward:'Ward 02',status:'partial',verified:'2026-06-15',hours:'09:00 – 18:00',accessible:false,water:true,free:true,x:19,y:72,scores:[75,65,30,80,65,75,60,100,60]}
];
export const statusLabels={usable:'Usable',partial:'Partly usable',unusable:'Not usable',unverified:'Unverified'};
export function score(values){const valid=values.filter(v=>Number.isFinite(v));return valid.length?Math.round(valid.reduce((a,b)=>a+b,0)/valid.length):null;}
export function filterFacilities({query='',type='All amenities',ward='All wards',usable=false,accessible=false}){return facilities.filter(f=>(type==='All amenities'||f.type===type)&&(ward==='All wards'||f.ward===ward)&&(!usable||f.status==='usable')&&(!accessible||f.accessible)&&`${f.name} ${f.ward}`.toLowerCase().includes(query.toLowerCase()));}
export const initialComplaints=[{id:'JS-DEMO-001',facility:'F004',category:'Damaged',description:'The shelter roof and seating need repair.',status:'In progress',priority:'High',assignee:'Demo maintenance team',created:'2026-10-27T09:00:00Z',events:[{status:'Submitted',at:'2026-10-27T09:00:00Z',reason:'Demo citizen report'},{status:'In progress',at:'2026-10-28T10:00:00Z',reason:'Demo maintenance team assigned'}]}];
