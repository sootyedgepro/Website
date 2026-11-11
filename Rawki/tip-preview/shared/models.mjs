export const CLASS_EVENT=Object.freeze({
 id:'tip-owner-review-2026-11-14',
 title:'Traveling in Profit — live class with Zi Morris',
 startsAt:'2026-11-14T17:00:00Z',
 durationMinutes:55,
 timeZone:'America/New_York'
});
export const TOOLS=Object.freeze([
 {name:'Flow Tracker',role:'Read direction',question:'What are trend and momentum showing?',detail:'Dashboard, directional lines, bands, and swing markers.',slug:'flow-tracker'},
 {name:'Action Zones',role:'Locate reaction areas',question:'Where might price react?',detail:'Weekly and monthly buy, sell, support, and resistance areas.',slug:'action-zones'},
 {name:'Tunnel Bands',role:'Map the week',question:'Where is price within fixed weekly levels?',detail:'A central reference with four upper and four lower levels.',slug:'tunnel-bands'}
]);
export const CHANGES={
 sootyedge:[
  ['guided-suite','Explore the live chart with a three-stage guided cursor tour'],
  ['demo-cookie','Verify the interactive chart stops when its preference cookie is off'],
  ['suite-funnel','Review the shorter chart-to-offer and activation path'],
  ['chart-viewer','Explore charts in an accessible viewer with zoom'],
  ['comparison','Compare the three tools in one place'],
  ['activation','Review the purchase and activation journey'],
  ['guide','Find the free preparation guide earlier'],
  ['connected-sites','Move between the class and software journeys']
 ],
 travelinginprofit:[
  ['class-funnel','Review the shorter class page with one visible registration form'],
  ['local-time','See the class in your own time zone'],
  ['calendar','Download a calendar invitation with a matching date'],
  ['registration','Review registration validation and confirmation'],
  ['mobile-reserve','Reserve from a compact mobile bar'],
  ['result-context','Read member results with their original time periods'],
  ['connected-sites','Explore the related software without losing the class']
 ]
};
export function eventStatus(event=CLASS_EVENT,now=Date.now()){
 const start=Date.parse(event.startsAt),end=start+event.durationMinutes*60000;
 return now<start?'upcoming':now<end?'live':'ended';
}
export function countdown(event=CLASS_EVENT,now=Date.now()){
 let seconds=Math.max(0,Math.floor((Date.parse(event.startsAt)-now)/1000));
 const days=Math.floor(seconds/86400);seconds%=86400;
 const hours=Math.floor(seconds/3600);seconds%=3600;
 const minutes=Math.floor(seconds/60);seconds%=60;
 return {days,hours,minutes,seconds};
}
export function eventDate(event=CLASS_EVENT,zone=event.timeZone){
 return new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(event.startsAt));
}
export function eventTime(event=CLASS_EVENT,zone=event.timeZone){
 return new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(event.startsAt));
}
export function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())}
export function validUsername(value){return value.trim().length>=3&&value.trim().length<=50&&!/[\s/@]/.test(value)&&!value.includes('://')}
export function escapeIcs(value){return String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
export function foldIcsLine(line){let result='',length=0;const encoder=new TextEncoder();for(const char of line){const bytes=encoder.encode(char).length;if(length+bytes>75){result+='\r\n ';length=1}result+=char;length+=bytes}return result}
export function calendarIcs(event=CLASS_EVENT,now=new Date()){
 const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const end=new Date(Date.parse(event.startsAt)+event.durationMinutes*60000);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Local Owner Review//Traveling in Profit//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
  'UID:'+escapeIcs(event.id)+'@local-review',
  'DTSTAMP:'+stamp(now),'DTSTART:'+stamp(new Date(event.startsAt)),'DTEND:'+stamp(end),
  'SUMMARY:'+escapeIcs(event.title),
  'DESCRIPTION:'+escapeIcs('LOCAL REVIEW DRAFT. This calendar entry is not a reservation. The site owner must confirm the schedule and joining instructions.'),
  'LOCATION:Online — joining details supplied by the host','END:VEVENT','END:VCALENDAR',''].map(foldIcsLine).join('\r\n');
}

