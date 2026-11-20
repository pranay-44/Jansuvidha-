export function setupWalking(map, L) {
  const panel = document.querySelector('#walking-controls');
  const button = id => panel.querySelector('#' + id);
  const locationStatus = button('location-status');
  const routeStatus = button('route-status');
  const modePicker = button('route-mode');
  let watch = null, generation = 0, following = false, origin, dot, circle;
  let destination, route, pending;
  // Keep every navigation path out of the amenity canvas's hit-testing surface.
  const pane = map.createPane('walking');
  pane.style.zIndex = '390';
  pane.style.pointerEvents = 'none';
  const overlay = {renderer:L.svg({pane:'walking'}),pane:'walking',interactive:false};
  const distance = metres => metres < 1000 ? Math.round(metres) + ' m' : (metres / 1000).toFixed(1) + ' km';

  function clearRoute() {
    pending?.abort();
    pending = null;
    route?.remove();
    route = null;
  }
  function stopWatch() {
    generation++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    following = false;
    button('stop-location').hidden = true;
  }
  function mark(point, accuracy) {
    origin = point;
    const latlng = [point.latitude, point.longitude];
    if (dot) dot.setLatLng(latlng);
    else dot = L.circleMarker(latlng, {...overlay,radius:8, color:'white', weight:3, fillColor:'#1769cf', fillOpacity:1}).addTo(map);
    if (accuracy != null) {
      if (circle) circle.setLatLng(latlng).setRadius(accuracy);
      else circle = L.circle(latlng, {...overlay,radius:accuracy, stroke:false, fillColor:'#1769cf', fillOpacity:0.15}).addTo(map);
    } else { circle?.remove(); circle = null; }
    dot.bringToFront();
    if (following) map.setView(latlng, Math.max(16,map.getZoom()));
  }
  async function directions() {
    clearRoute();
    if (!destination) return;
    if (!origin) {
      routeStatus.textContent = 'For directions to ' + destination.name + ', use My location or choose a starting point.';
      return;
    }
    following = false;
    const end = destination.entrance ?? destination;
    const points = [[origin.latitude,origin.longitude],[end.latitude,end.longitude]];
    const direct = destination.name + ' · ' + distance(map.distance(...points)) + ' straight-line distance';
    route = L.polyline(points,{...overlay,color:'#536b82',weight:3,dashArray:'6 8'}).addTo(map);
    map.fitBounds(route.getBounds(), {padding:[24,24],maxZoom:18});
    const mode = modePicker.value;
    const body = JSON.stringify({origin, facilityId:destination.id,mode});
    const controller = new AbortController();
    pending = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]);
    routeStatus.textContent = direct + ' · Finding directions…';
    try {
      const session = await fetch('/api/auth/session', {signal});
      if (!session.ok) throw Error('Could not start a map session. Try again.');
      const {csrf} = await session.json();
      const response = await fetch('/api/directions', {method:'POST', signal,
        headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body});
      const result = await response.json();
      if (pending !== controller) return;
      if (!response.ok) throw Error(result.message || 'Directions are unavailable.');
      route.remove();
      route = L.geoJSON(result.geometry, {...overlay,style:{color:'#194ea6',weight:5,dashArray:mode==='bus'?'6 6':null}}).addTo(map);
      route.bringToBack();
      following = false;
      map.fitBounds(route.getBounds(), {padding:[24,24],maxZoom:18});
      routeStatus.textContent = destination.name + ' · ' + (mode==='bus'?result.description:
        distance(result.distanceMeters) + (mode==='drive'?' by car':' on foot'));
    } catch (error) {
      if (pending === controller) routeStatus.textContent = direct + '. ' + (error.name === 'TimeoutError'
        ? 'Directions timed out. Try updating the route.'
        : error instanceof SyntaxError || error instanceof TypeError ? 'Cannot reach the JanSuvidha routing server.' : error.message);
    } finally { if (pending === controller) pending = null; }
  }
  button('my-location').onclick = () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = 'Live location needs HTTPS or localhost and browser location access. Choose a starting point below.';
      return;
    }
    following = true;
    if (watch !== null && origin) { map.setView([origin.latitude,origin.longitude],16); return; }
    if (watch !== null) return;
    const token = ++generation;
    let firstFix = true;
    locationStatus.textContent = 'Waiting for your location…';
    button('stop-location').hidden = false;
    watch = navigator.geolocation.watchPosition(({coords,timestamp}) => {
      if (generation !== token) return;
      mark({latitude:coords.latitude,longitude:coords.longitude},coords.accuracy);
      locationStatus.textContent = 'Location accuracy about ' + Math.round(coords.accuracy) + ' m. Updated ' + new Date(timestamp).toLocaleTimeString() + '.';
      if (firstFix && destination) directions();
      firstFix = false;
    }, error => {
      if (generation !== token) return;
      stopLocation();
      locationStatus.textContent = (error.code === 1 ? 'Location permission denied.' : 'Live location unavailable.') + ' You can choose a starting point.';
    }, {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  };
  function stopLocation() {
    stopWatch();
    endDirections();
    dot?.remove(); circle?.remove();
    dot = circle = origin = null;
    locationStatus.textContent = 'Live location stopped.';
  }
  button('stop-location').onclick = stopLocation;
  map.on('dragstart', () => { following = false; });
  button('manual-start').onclick = () => {
    stopWatch();
    const point = map.getCenter();
    mark({latitude:point.lat,longitude:point.lng},null);
    locationStatus.textContent = 'Starting point set at the map centre.';
    if (destination) directions();
  };
  button('update-walk').onclick = directions;
  modePicker.onchange = directions;
  function endDirections() {
    clearRoute(); destination = null; routeStatus.textContent = '';
    button('walk-actions').hidden = true;
  }
  button('clear-walk').onclick = endDirections;
  return {
    pauseFollow() { following = false; },
    select(facility,mode='walk') {
      modePicker.value = mode;
      destination = facility;
      button('walk-actions').hidden = false;
      panel.scrollIntoView({block:'nearest'});
      directions();
    },
    destroy() { stopWatch(); clearRoute(); }
  };
}
