// OSM strings are untrusted: every text field passes through the caller's HTML escape.
export function busStopDetails(f,esc,compact=false){
  const basics=`<div class="bus-stop-details"><p><strong>Address:</strong> ${esc(f.address)}</p><p><strong>Direction:</strong> ${esc(f.heading)}${f.heading_source==='unknown'?'':' (estimated)'}</p></div>`;
  if(compact)return basics;
  return basics+`<p class="note">${f.address_source==='nearest_road_estimate'?'Address estimated from the nearest mapped road. ':''}Bus-stop locations and directions are based on OpenStreetMap and may need field verification.</p><p class="note">Source: <a href="${esc(f.source_url)}" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a></p>`;
}
