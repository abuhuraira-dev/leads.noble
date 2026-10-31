// Country -> regions -> shortlisted industries. Industry names must exist in core.mjs `niches`.
// tier 1-4 = the priority order for the automatic daily rotation (0 = available in the dropdown only).
const c=(code,name,tier,regions,industries)=>({code,name,tier,regions,industries});
export const COUNTRIES=[
 c('US','United States',1,['Texas','Florida','California','New York','New Jersey','Georgia','Arizona','North Carolina','Virginia'],['Dentists','Med spas','Alternative health','HVAC','Roofing','Plumbers','Electricians','Lawyers','Accountants','Real estate','Insurance agents','Car repair','Construction']),
 c('GB','United Kingdom',1,['London','Manchester','Birmingham','Leeds','Bristol','Glasgow','Edinburgh','Cardiff'],['Real estate','Lawyers','Accountants','Dentists','Clinics','Construction','Plumbers','Electricians','Salons','Wedding & event venues','Recruitment']),
 c('CA','Canada',1,['Ontario','British Columbia','Alberta','Quebec'],['Dentists','Physiotherapy','Construction','Roofing','Landscaping','Lawyers','Real estate','Accountants','Salons','Car repair']),
 c('AU','Australia',1,['New South Wales','Victoria','Queensland','Western Australia'],['Plumbers','Electricians','Dentists','Physiotherapy','Mortgage & finance','Accountants','Real estate','Solar installers','Construction','Clinics']),
 c('AE','United Arab Emirates',2,['Dubai','Abu Dhabi','Sharjah','Ajman'],['Real estate','Dentists','Med spas','Salons','Gyms','Restaurants','Business consulting','Lawyers','Car detailing']),
 c('ZA','South Africa',3,['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape'],['Accountants','Lawyers','Real estate','Medical practices','Construction','Solar installers','Car repair','Hotels','Restaurants']),
 c('DE','Germany',4,['Berlin','Bavaria','North Rhine-Westphalia','Hamburg','Hesse','Baden-Württemberg'],['Medical practices','Plumbers','Electricians','Tax advisers','Lawyers','Real estate','Restaurants','Tutoring centers']),
 c('ES','Spain',4,['Madrid','Catalonia','Andalusia','Valencia','Basque Country'],['Hotels','Restaurants','Real estate','Clinics','Salons','Construction','Lawyers','Language schools','Car repair']),
 c('IT','Italy',4,['Lombardy','Lazio','Veneto','Emilia-Romagna','Tuscany'],['Restaurants','Hotels','Clinics','Real estate','Construction','Accountants','Lawyers']),
 c('FR','France',4,['Île-de-France','Auvergne-Rhône-Alpes','Provence-Alpes-Côte d’Azur','Occitanie'],['Clinics','Salons','Restaurants','Plumbers','Electricians','Real estate','Lawyers','Hotels','Tutoring centers']),
 c('NZ','New Zealand',0,['Auckland','Wellington','Christchurch','Hamilton','Tauranga'],['Construction','Plumbers','Electricians','Real estate','Dentists','Physiotherapy','Accountants','Car repair']),
 c('SA','Saudi Arabia',0,['Riyadh','Jeddah','Dammam','Mecca','Medina','Khobar'],['Clinics','Real estate','Restaurants','Wedding & event venues','Plumbers','Electricians','Tutoring centers','Gyms','Car repair','Travel agencies']),
 c('PK','Pakistan',0,['Lahore','Rawalpindi','Faisalabad','Gujranwala','Karachi','Hyderabad','Peshawar','Abbottabad','Islamabad'],['Clinics','Tutoring centers','Real estate','Restaurants','Salons','Gyms','Travel agencies','Wedding & event venues','IT services','Plumbers','Electricians']),
 c('IN','India',0,['Maharashtra','Karnataka','Delhi','Telangana','Tamil Nadu','Gujarat','Kerala','West Bengal'],['Tutoring centers','Clinics','Dentists','Real estate','Business consulting','Wedding & event venues','Salons','Restaurants','IT services']),
 c('IE','Ireland',0,['Dublin','Cork','Galway','Limerick','Waterford'],['Plumbers','Electricians','Dentists','Lawyers','Accountants','Real estate','Clinics','Hotels','Wedding & event venues','Construction']),
 c('SG','Singapore',0,['Central Region','East Region','West Region','North Region'],['Tutoring centers','Clinics','Real estate','Accountants','Recruitment','Salons','Restaurants','Business consulting']),
 c('MY','Malaysia',0,['Selangor','Kuala Lumpur','Penang','Johor','Sabah'],['Clinics','Tutoring centers','Real estate','Restaurants','Salons','Car repair','Construction','Travel agencies']),
 c('PH','Philippines',0,['Metro Manila','Cebu','Davao','Calabarzon','Central Luzon'],['Dentists','Tutoring centers','Real estate','Plumbers','Salons','Restaurants','Recruitment','Accountants','Hotels']),
 c('NL','Netherlands',0,['North Holland','South Holland','Utrecht','North Brabant'],['Accountants','Dentists','Plumbers','Electricians','Real estate','Recruitment','Business consulting','Restaurants']),
 c('BR','Brazil',0,['São Paulo','Rio de Janeiro','Minas Gerais','Paraná','Bahia'],['Dentists','Clinics','Lawyers','Real estate','Gyms','Salons','Restaurants','Construction','Tutoring centers','Car repair']),
 c('MX','Mexico',0,['Mexico City','Jalisco','Nuevo León','Quintana Roo','Puebla'],['Real estate','Dentists','Hotels','Restaurants','Car repair','Construction','Lawyers','Gyms','Salons','Tutoring centers']),
];
export const AUTO_POOL=COUNTRIES.filter(x=>x.tier>0);
const WEIGHT={1:4,2:3,3:2,4:1};
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
// Weighted shuffle of every country+industry pair. The order is fixed for two days, then reshuffles.
// Pairs already used (history) are skipped until the whole list has been cycled. One country, one industry, two regions.
export function pickCampaign({day,history=[],pool=AUTO_POOL,only=null}){
 const r=rng(Math.floor(day/2)*7919+17),pairs=[];
 for(const x of pool)for(const industry of x.industries)if(!only||only.includes(industry))pairs.push({x,industry,key:x.code+'|'+industry,k:-Math.log(r()||1e-9)/WEIGHT[x.tier||1]});
 pairs.sort((a,b)=>a.k-b.k);
 const fresh=pairs.filter(p=>!history.includes(p.key)),p=(fresh.length?fresh:pairs)[0],i=Math.floor(r()*p.x.regions.length);
 return {country:p.x.code,countryName:p.x.name,industry:p.industry,key:p.key,regions:[...new Set([p.x.regions[i],p.x.regions[(i+1)%p.x.regions.length]])],cycled:!fresh.length};
}

// City centres (approximate) so city searches use a cheap radius query; states and provinces still use the boundary lookup.
export const CITY_CENTERS={"AE|Dubai": [25.2048, 55.2708], "AE|Abu Dhabi": [24.4539, 54.3773], "AE|Sharjah": [25.3463, 55.4209], "AE|Ajman": [25.4052, 55.5136], "GB|London": [51.5074, -0.1278], "GB|Manchester": [53.4808, -2.2426], "GB|Birmingham": [52.4862, -1.8904], "GB|Leeds": [53.8008, -1.5491], "GB|Bristol": [51.4545, -2.5879], "GB|Glasgow": [55.8642, -4.2518], "GB|Edinburgh": [55.9533, -3.1883], "GB|Cardiff": [51.4816, -3.1791], "PK|Karachi": [24.8607, 67.0011], "PK|Lahore": [31.5204, 74.3587], "PK|Rawalpindi": [33.5651, 73.0169], "PK|Faisalabad": [31.4504, 73.135], "PK|Gujranwala": [32.1877, 74.1945], "PK|Hyderabad": [25.396, 68.3578], "PK|Peshawar": [34.0151, 71.5249], "PK|Abbottabad": [34.1688, 73.2215], "PK|Islamabad": [33.6844, 73.0479], "NZ|Auckland": [-36.8509, 174.7645], "NZ|Wellington": [-41.2866, 174.7756], "NZ|Christchurch": [-43.5321, 172.6362], "NZ|Hamilton": [-37.787, 175.2793], "NZ|Tauranga": [-37.6878, 176.1651], "SA|Riyadh": [24.7136, 46.6753], "SA|Jeddah": [21.4858, 39.1925], "SA|Dammam": [26.4207, 50.0888], "SA|Mecca": [21.3891, 39.8579], "SA|Medina": [24.5247, 39.5692], "SA|Khobar": [26.2172, 50.1971], "IE|Dublin": [53.3498, -6.2603], "IE|Cork": [51.8985, -8.4756], "IE|Galway": [53.2707, -9.0568], "IE|Limerick": [52.6638, -8.6267], "IE|Waterford": [52.2593, -7.1101], "DE|Berlin": [52.52, 13.405], "DE|Hamburg": [53.5511, 9.9937], "ES|Madrid": [40.4168, -3.7038], "ES|Valencia": [39.4699, -0.3763], "MX|Mexico City": [19.4326, -99.1332], "PH|Cebu": [10.3157, 123.8854], "PH|Davao": [7.1907, 125.4553], "MY|Kuala Lumpur": [3.139, 101.6869]};

// Industries the free Geoapify Places API can search (reliable). Other industries can only use the busy public OpenStreetMap servers.
export const GEO_CATEGORIES={
 Dentists:['healthcare.dentist'],Restaurants:['catering.restaurant'],'Cafés':['catering.cafe'],Salons:['service.beauty.hairdresser'],Clinics:['healthcare.clinic_or_praxis'],
 Hotels:['accommodation.hotel'],Electricians:['service.electrician'],'Real estate':['office.estate_agent','service.estate_agent'],Lawyers:['office.lawyer'],Accountants:['office.accountant'],
 Bakeries:['commercial.food_and_drink.bakery'],'Car repair':['service.vehicle.repair.car'],Florists:['commercial.florist'],'Med spas':['service.beauty.spa'],'Insurance agents':['office.insurance'],
 'Mortgage & finance':['office.financial_advisor'],'Tax advisers':['office.tax_advisor'],Recruitment:['office.employment_agency'],'Business consulting':['office.consulting'],
 'Driving schools':['education.driving_school'],'Language schools':['education.language_school'],'Wedding & event venues':['activity.events_venue'],'Car detailing':['service.vehicle.car_wash'],
 'Travel agencies':['service.travel_agency','office.travel_agent'],'Medical practices':['healthcare.clinic_or_praxis.general'],'IT services':['office.it'],
};
