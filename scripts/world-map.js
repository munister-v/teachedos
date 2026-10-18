/* World map - a live desktop background (world-map-wallpaper3, Kristina, 17.10.2026).
 *
 * A dotted world on a 15px grid: land dots breathe on their own sine, the
 * ocean is a faint grid, nine hub cities pulse and dashed arcs run between
 * them. The cursor lights the dots around it; a click on the bare desktop
 * sends a ripple and marks the country under it as visited (a lime pin with
 * its name) - a second click takes the mark off. Where your students are
 * from comes from the Journal by itself (Country / City on the student's
 * card): their countries turn violet and every city gets a violet pin with
 * the names on hover. Russia is not drawn and not named (Kristina, 17.10):
 * its territory renders as ocean.
 *
 * On the desktop: a canvas at the back of #desktop, under the windows and
 * widgets, pointer-events none; the hover label and the click work only on
 * the bare desktop. 30 fps, paused while the tab is hidden, a still frame
 * under prefers-reduced-motion. Three palettes: ink (dark), sand, silver.
 *
 * TeachedWorld.mount(host, { theme, visited, onVisited }) / .unmount() /
 * .setFeed([{ student, country, city }]) / .locate(country, city).
 */
(function () {
  'use strict';
  if (window.TeachedWorld) return;
  const FRAME_MS = 1000 / 30;

  /* ---------- simplified continent polygons, [lon,lat] ---------- */
  const POLYS = [
    [[-168,66],[-152,60],[-140,70],[-125,72],[-112,68],[-95,70],[-86,69],[-82,73],[-78,62],[-68,58],[-56,52],[-64,49],[-70,44],[-74,40],[-76,36],[-81,32],[-80,27],[-84,30],[-89,30],[-94,29],[-97,26],[-96,22],[-94,18],[-90,21],[-86,21],[-83,22],[-86,15],[-83,10],[-79,9],[-82,13],[-86,12],[-90,14],[-95,16],[-100,18],[-104,22],[-109,23],[-113,28],[-117,33],[-122,37],[-124,44],[-129,52],[-134,57],[-152,59],[-164,59]],
    [[-46,60],[-38,62],[-30,68],[-22,70],[-19,76],[-28,82],[-48,81],[-57,77],[-56,71],[-53,66]],
    [[-79,9],[-72,12],[-64,11],[-53,5],[-44,-1],[-35,-7],[-38,-13],[-39,-20],[-45,-24],[-49,-29],[-53,-34],[-57,-39],[-62,-41],[-65,-46],[-67,-51],[-68,-55],[-72,-54],[-74,-48],[-74,-38],[-72,-31],[-70,-21],[-74,-16],[-78,-9],[-81,-4],[-80,1],[-77,4],[-79,7]],
    [[-9,37],[-9,43],[-2,44],[-1,46],[-5,48],[-1,50],[2,51],[5,54],[8,55],[8,58],[11,59],[18,56],[21,59],[19,62],[13,64],[12,66],[16,68],[23,71],[32,70],[42,68],[55,69],[68,70],[80,73],[95,76],[108,77],[120,74],[132,72],[148,71],[160,70],[170,67],[178,66],[179,63],[165,61],[159,54],[151,51],[143,51],[141,44],[139,39],[136,35],[130,33],[123,31],[121,26],[116,23],[109,19],[107,12],[104,6],[101,7],[99,13],[95,16],[92,21],[89,22],[87,20],[82,16],[78,9],[76,11],[73,18],[69,22],[66,25],[61,25],[57,26],[52,28],[49,30],[51,25],[55,25],[59,23],[59,21],[55,17],[51,14],[45,12],[43,13],[40,19],[36,27],[35,31],[34,36],[28,37],[23,36],[19,40],[16,39],[13,41],[12,45],[8,44],[3,43],[-1,38]],
    [[-6,35],[0,36],[9,37],[11,34],[19,32],[29,31],[33,30],[35,27],[38,22],[40,16],[43,12],[48,11],[51,12],[49,6],[43,-3],[40,-13],[39,-22],[37,-28],[33,-29],[29,-33],[21,-35],[18,-33],[16,-28],[14,-19],[13,-11],[13,-5],[9,0],[9,4],[-7,5],[-12,8],[-16,14],[-17,19],[-16,24],[-14,28],[-10,31]],
    [[95,5],[100,1],[104,-3],[106,-6],[103,-4],[98,2],[95,4]],
    [[105,-6],[110,-7],[114,-8],[114,-9],[106,-8]],
    [[109,2],[114,4],[119,2],[118,-2],[113,-3],[109,-1]],
    [[131,-1],[136,-2],[141,-3],[146,-6],[143,-8],[137,-6],[132,-4]],
    [[130,31],[133,34],[137,35],[140,37],[141,41],[142,45],[144,44],[141,39],[138,36],[134,34],[131,33]],
    [[-5,50],[-3,52],[-4,55],[-5,58],[-2,58],[-1,55],[0,52],[0,50]],
    [[113,-22],[114,-28],[115,-34],[119,-35],[125,-33],[130,-32],[133,-32],[136,-35],[139,-36],[141,-39],[146,-39],[150,-37],[153,-31],[153,-26],[150,-23],[146,-19],[143,-14],[142,-11],[141,-15],[139,-19],[137,-15],[136,-12],[133,-11],[127,-14],[123,-17],[118,-20]],
    [[167,-46],[170,-44],[172,-42],[174,-39],[177,-38],[175,-40],[173,-42],[172,-44],[168,-47]],
  ];
  function inPoly(lon, lat, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  const isLand = (lon, lat) => POLYS.some(p => inPoly(lon, lat, p));

  /* ---------- countries (simplified schematic polygons, [lon,lat]); f = fallback ellipse for small ones ---------- */
  const COUNTRIES = [
    { n: 'Ireland', p: [[[-10,52],[-6,52],[-6,55],[-8,56],[-10,54]]] },
    { n: 'United Kingdom', p: [[[-5,50],[-3,52],[-4,55],[-5,58],[-2,58],[-1,55],[0,52],[0,50]]] },
    { n: 'Portugal', p: [[[-9,43],[-8,42],[-8,39],[-8,37],[-9,37],[-9,40]]], f: [-8.5,39.5,1.2,3] },
    { n: 'Spain', p: [[[-9,43],[-2,44],[0,43],[3,42],[3,39],[0,38],[-2,37],[-6,36],[-9,37],[-9,41]]] },
    { n: 'France', p: [[[-5,48],[-1,49],[2,51],[6,50],[8,49],[8,47],[7,46],[6,44],[3,43],[0,43],[-2,44],[-4,46]]] },
    { n: 'Belgium', p: [[[2,51],[5,51],[6,50],[5,49],[3,50]]], f: [4.5,50.5,1.6,1] },
    { n: 'Netherlands', p: [[[3,51],[6,51],[7,52],[7,53],[5,54],[3,53]]], f: [5.3,52.2,1.8,1.2] },
    { n: 'Germany', p: [[[6,54],[8,55],[11,54],[14,54],[15,52],[14,50],[12,49],[10,47],[8,48],[6,49],[6,52]]] },
    { n: 'Denmark', p: [[[8,55],[10,55],[12,56],[11,57],[8,57]]], f: [9.5,56,2,1.4] },
    { n: 'Norway', p: [[[5,60],[5,62],[9,64],[13,66],[18,68],[24,71],[30,71],[26,69],[19,68],[13,65],[9,62],[6,60]]] },
    { n: 'Sweden', p: [[[11,59],[12,57],[15,56],[17,58],[18,60],[17,62],[20,65],[23,66],[21,63],[18,61],[14,60]]] },
    { n: 'Finland', p: [[[21,61],[21,64],[24,66],[29,66],[31,63],[30,61],[27,60],[23,60]]] },
    { n: 'Poland', p: [[[14,54],[18,55],[22,55],[24,53],[23,50],[20,50],[17,51],[14,52]]] },
    { n: 'Czechia', p: [[[12,51],[15,51],[18,50],[17,49],[14,49],[12,50]]], f: [15.5,49.8,2.6,1] },
    { n: 'Austria', p: [[[10,47],[13,47],[16,48],[15,49],[12,49],[10,48]]], f: [14,47.6,2.6,1] },
    { n: 'Switzerland', p: [[[6,47],[8,48],[10,47],[10,46],[7,46]]], f: [8,46.8,1.8,1] },
    { n: 'Italy', p: [[[8,44],[11,44],[13,46],[15,45],[16,42],[18,41],[18,40],[16,40],[16,38],[15,40],[13,41],[10,43]]], f: [12.5,42.5,2.2,3.4] },
    { n: 'Croatia', p: [[[14,45],[16,46],[19,46],[19,44],[17,43],[14,43]]], f: [16,44.5,2.4,1.4] },
    { n: 'Hungary', p: [[[17,48],[20,48],[22,48],[22,46],[19,46],[16,47]]], f: [19.5,47.2,2.4,1] },
    { n: 'Romania', p: [[[20,46],[23,48],[26,48],[29,46],[29,44],[25,44],[21,44]]] },
    { n: 'Greece', p: [[[20,42],[23,41],[26,41],[27,40],[26,38],[24,36],[22,37],[21,39],[19,40]]], f: [22,39,2,2] },
    // Crimea is Ukraine: the coast runs round the peninsula
    { n: 'Ukraine', p: [[[23,52],[28,53],[32,52],[36,52],[39,50],[39,47],[37.5,46.6],[36.6,45.4],[35.4,44.6],[33.4,44.4],[32.5,45.4],[33.6,46.1],[31,46.4],[27,46],[24,48],[22,50]]] },
    { n: 'Turkey', p: [[[26,42],[31,42],[37,42],[42,42],[44,40],[41,39],[36,36],[30,36],[27,37],[26,40]]] },
    { n: 'Israel', p: [[[34,31],[35,32],[36,33],[35,31],[34,29]]], f: [35,31.2,1.1,1.6] },
    { n: 'UAE', p: [[[51,25],[54,25],[56,26],[56,24],[53,24],[51,24]]], f: [54,24.2,2.2,1.2] },
    { n: 'Saudi Arabia', p: [[[35,28],[38,31],[42,31],[48,30],[50,28],[52,25],[55,25],[59,23],[59,22],[55,17],[51,14],[45,12],[43,12],[40,16],[37,22]]] },
    { n: 'Iraq', p: [[[39,37],[43,37],[46,35],[48,30],[47,29],[43,31],[40,33]]], f: [44,33,2.6,2.6] },
    { n: 'Iran', p: [[[44,39],[48,38],[53,38],[55,37],[59,35],[61,31],[58,27],[52,27],[49,30],[47,33],[44,36]]] },
    { n: 'Pakistan', p: [[[61,30],[66,31],[70,30],[73,28],[71,24],[67,23],[62,25]]] },
    { n: 'India', p: [[[74,36],[78,34],[81,31],[85,28],[89,28],[92,28],[95,29],[97,28],[95,25],[92,22],[88,22],[86,20],[82,16],[80,14],[77,8],[76,12],[73,18],[70,22],[68,23],[70,26],[72,30]]] },
    { n: 'Nepal', p: [[[80,30],[84,29],[88,28],[87,27],[82,27],[80,28]]], f: [84,28,3,1.2] },
    { n: 'Mongolia', p: [[[88,48],[95,49],[103,49],[110,49],[118,50],[120,50],[117,47],[110,46],[100,46],[92,46],[88,47]]] },
    { n: 'South Korea', p: [[[126,38],[128,39],[129,38],[129,35],[127,34],[126,36]]], f: [127.8,36.5,1.4,1.8] },
    { n: 'Japan', p: [[[130,31],[133,34],[137,35],[140,37],[141,41],[142,45],[144,44],[141,39],[138,36],[134,34],[131,33]]], f: [138,37.5,2.4,3.6] },
    { n: 'Thailand', p: [[[98,16],[99,12],[100,9],[101,7],[102,9],[103,12],[104,15],[105,18],[104,20],[100,20],[98,18]]], f: [101,15.5,2,4.5] },
    { n: 'Vietnam', p: [[[103,20],[105,18],[107,15],[108,12],[109,10],[107,9],[104,9],[102,11],[103,16]]], f: [106,14,1.8,4.5] },
    { n: 'Malaysia', p: [[[100,6],[102,5],[104,2],[101,2],[99,5]],[[109,2],[113,4],[118,3],[118,1],[113,0],[110,1]]], f: [101.5,4,2,1.8] },
    { n: 'Philippines', p: [[[120,18],[122,17],[122,14],[120,14],[119,16]],[[122,9],[124,10],[126,9],[124,6],[122,7]]], f: [122,12.5,2,3.5] },
    { n: 'Indonesia', p: [[[95,5],[100,1],[104,-3],[106,-6],[103,-4],[98,2]],[[105,-6],[110,-7],[114,-8],[114,-9],[106,-8]],[[109,2],[114,4],[119,2],[118,-2],[113,-3],[109,-1]],[[131,-1],[136,-2],[141,-3],[146,-6],[143,-8],[137,-6],[132,-4]]], f: [113,-1.5,3,2.5] },
    { n: 'Kazakhstan', p: [[[50,51],[56,51],[63,51],[70,51],[78,51],[85,50],[87,49],[83,47],[78,44],[71,44],[66,46],[60,46],[54,46],[51,47]]] },
    { n: 'China', p: [[[74,40],[79,44],[85,47],[90,48],[96,49],[103,49],[110,49],[117,50],[122,49],[127,50],[131,48],[132,44],[130,42],[126,41],[122,39],[121,36],[120,33],[121,30],[118,27],[114,23],[109,20],[106,22],[103,22],[99,24],[96,29],[92,28],[89,28],[85,28],[81,30],[79,34],[75,38]]] },
    // not drawn and not named: kept only so its territory resolves to ocean before the neighbours' fallbacks
    { n: 'Russia', p: [[[28,60],[30,64],[33,66],[37,65],[42,67],[50,69],[60,70],[70,71],[80,73],[92,75],[103,77],[113,74],[124,72],[136,72],[148,71],[159,70],[169,67],[178,66],[179,63],[170,61],[162,60],[159,55],[152,51],[143,51],[142,47],[140,46],[135,44],[132,43],[130,45],[127,48],[122,49],[117,50],[110,49],[103,49],[96,49],[90,48],[85,48],[80,49],[72,50],[66,50],[60,51],[55,51],[50,50],[46,48],[41,47],[39,48],[39,50],[36,50],[36,52],[32,53],[30,55],[28,57]]] },
    { n: 'Egypt', p: [[[22,32],[30,31],[32,31],[34,28],[35,24],[33,22],[22,22]]] },
    { n: 'Libya', p: [[[11,33],[19,32],[25,32],[25,22],[20,20],[15,21],[11,24],[10,30]]] },
    { n: 'Algeria', p: [[[-6,35],[2,37],[9,37],[10,34],[9,28],[6,23],[2,22],[-3,24],[-6,28],[-8,31]]] },
    { n: 'Morocco', p: [[[-10,31],[-9,33],[-6,35],[-2,35],[-1,33],[-4,31],[-8,28],[-11,28]]], f: [-6,31.5,2.4,2] },
    { n: 'Sudan', p: [[[22,22],[31,22],[33,21],[36,19],[38,18],[36,15],[33,13],[27,13],[24,14],[22,17]]] },
    { n: 'Ethiopia', p: [[[33,13],[36,15],[40,15],[43,12],[44,11],[42,7],[39,5],[35,7],[33,10]]], f: [39,9,3,3] },
    { n: 'Nigeria', p: [[[3,7],[3,11],[6,13],[10,13],[13,11],[14,8],[12,5],[8,4],[4,5]]], f: [8,9.5,3.4,3.4] },
    { n: 'Kenya', p: [[[34,5],[38,5],[41,2],[41,-2],[38,-4],[34,-2],[33,1]]], f: [37.5,0.5,3,3.4] },
    { n: 'Angola', p: [[[13,-6],[14,-12],[15,-18],[17,-18],[21,-18],[22,-14],[21,-10],[18,-6],[14,-5]]], f: [17.5,-12.5,3.4,4.5] },
    { n: 'Tanzania', p: [[[30,-1],[33,-1],[34,-4],[38,-7],[40,-11],[38,-16],[34,-15],[31,-9],[30,-4]]], f: [35,-6.5,3,4] },
    { n: 'Madagascar', p: [[[44,-16],[48,-15],[50,-18],[48,-22],[46,-25],[44,-24],[43,-19]]], f: [46.5,-19.5,2,3.4] },
    { n: 'South Africa', p: [[[17,-32],[20,-35],[27,-34],[32,-29],[31,-26],[28,-24],[24,-21],[20,-18],[18,-21],[17,-27]]] },
    { n: 'Greenland', p: [[[-46,60],[-38,62],[-30,68],[-22,70],[-19,76],[-28,82],[-48,81],[-57,77],[-56,71],[-53,66]]] },
    { n: 'Canada', p: [[[-141,70],[-128,70],[-114,68],[-98,70],[-88,69],[-84,72],[-80,73],[-78,63],[-70,59],[-65,54],[-65,50],[-78,44],[-85,45],[-90,48],[-96,49],[-108,49],[-122,49],[-133,51],[-139,58],[-141,64]]] },
    { n: 'USA', p: [[[-124,47],[-123,49],[-110,49],[-98,49],[-90,48],[-85,46],[-80,44],[-76,41],[-72,41],[-69,44],[-68,47],[-72,44],[-75,39],[-76,35],[-81,32],[-81,26],[-84,30],[-89,30],[-94,29],[-97,26],[-101,29],[-106,32],[-111,31],[-115,32],[-117,33],[-121,36],[-124,42]]] },
    { n: 'Mexico', p: [[[-117,33],[-111,31],[-105,29],[-100,25],[-97,26],[-96,21],[-94,18],[-90,21],[-87,21],[-88,16],[-93,14],[-98,16],[-103,18],[-105,21],[-108,24],[-111,28],[-114,30]]] },
    { n: 'Colombia', p: [[[-77,4],[-79,9],[-73,12],[-65,11],[-61,9],[-66,5],[-70,1],[-73,-2],[-76,1]]], f: [-73,4,3,3] },
    { n: 'Venezuela', p: [[[-73,12],[-65,11],[-61,9],[-60,6],[-65,4],[-70,6],[-72,9]]], f: [-66,7.5,3,2.4] },
    { n: 'Peru', p: [[[-81,-4],[-79,-8],[-76,-14],[-72,-18],[-69,-18],[-70,-12],[-73,-7],[-77,-3],[-80,-1]]], f: [-75,-9.5,3,4] },
    { n: 'Bolivia', p: [[[-70,-11],[-65,-10],[-59,-14],[-58,-19],[-62,-22],[-66,-21],[-69,-17]]], f: [-64,-17,3.4,3.4] },
    { n: 'Brazil', p: [[[-52,4],[-50,1],[-44,-2],[-35,-7],[-38,-13],[-39,-20],[-45,-24],[-49,-29],[-53,-34],[-57,-33],[-58,-28],[-57,-21],[-60,-16],[-64,-11],[-68,-8],[-72,-5],[-70,-2],[-62,0],[-55,2]]] },
    { n: 'Argentina', p: [[[-70,-19],[-70,-27],[-71,-34],[-73,-42],[-74,-50],[-71,-54],[-67,-55],[-65,-50],[-63,-43],[-60,-39],[-56,-36],[-53,-34],[-56,-30],[-59,-26],[-63,-23],[-67,-21]]] },
    { n: 'Chile', p: [[[-70,-18],[-69,-24],[-70,-31],[-72,-37],[-73,-43],[-74,-50],[-72,-54],[-70,-51],[-72,-44],[-71,-36],[-70,-28],[-69,-21]]], f: [-70.5,-33,1.1,7] },
    { n: 'Uruguay', p: [[[-58,-30],[-54,-32],[-53,-34],[-56,-35],[-58,-33]]], f: [-56,-33,1.8,1.6] },
    { n: 'Australia', p: [[[113,-22],[114,-28],[115,-34],[119,-35],[125,-33],[130,-32],[133,-32],[136,-35],[139,-36],[141,-39],[146,-39],[150,-37],[153,-31],[153,-26],[150,-23],[146,-19],[143,-14],[142,-11],[141,-15],[139,-19],[137,-15],[136,-12],[133,-11],[127,-14],[123,-17],[118,-20]]] },
    { n: 'New Zealand', p: [[[167,-46],[170,-44],[172,-42],[174,-39],[177,-38],[175,-40],[173,-42],[172,-44],[168,-47]]], f: [172,-42,2,3.4] },
  ];
  const HIDDEN = 'Russia';
  function findCountry(lon, lat) {
    for (const c of COUNTRIES) for (const p of c.p) if (inPoly(lon, lat, p)) return c;
    let best = null, bd = 1e9;
    for (const c of COUNTRIES) {
      if (!c.f) continue;
      const dx = (lon - c.f[0]) / c.f[2], dy = (lat - c.f[1]) / c.f[3], d = dx * dx + dy * dy;
      if (d < 1 && d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function isLandEff(lon, lat) {
    if (!isLand(lon, lat)) return false;
    const c = findCountry(lon, lat);
    if (c) return c.n !== HIDDEN;
    if (lat >= 60 && lon >= 32) return false;   // Arctic / Siberia beyond the schematic polygon
    if (lon >= 100 && lat >= 52) return false;  // Far East beyond the schematic polygon
    return true;
  }

  /* ---------- where a student lives: country (+ city) -> a point ----------
     Capitals stand in for a country; a city we know gets its own point. Names
     are matched loosely (English, Ukrainian, a few common short forms). */
  const CAPITAL = {
    'Ireland': [-6.26,53.35], 'United Kingdom': [-0.13,51.5], 'Portugal': [-9.14,38.72], 'Spain': [-3.7,40.42], 'France': [2.35,48.86],
    'Belgium': [4.35,50.85], 'Netherlands': [4.9,52.37], 'Germany': [13.4,52.52], 'Denmark': [12.57,55.68], 'Norway': [10.75,59.91],
    'Sweden': [18.07,59.33], 'Finland': [24.94,60.17], 'Poland': [21.01,52.23], 'Czechia': [14.42,50.09], 'Austria': [16.37,48.21],
    'Switzerland': [7.45,46.95], 'Italy': [12.5,41.9], 'Croatia': [15.98,45.81], 'Hungary': [19.04,47.5], 'Romania': [26.1,44.43],
    'Greece': [23.73,37.98], 'Ukraine': [30.52,50.45], 'Turkey': [32.85,39.93], 'Israel': [35.21,31.77], 'UAE': [54.37,24.45],
    'Saudi Arabia': [46.68,24.71], 'Iraq': [44.36,33.31], 'Iran': [51.39,35.69], 'Pakistan': [73.05,33.68], 'India': [77.21,28.61],
    'Nepal': [85.32,27.72], 'Mongolia': [106.92,47.92], 'South Korea': [126.98,37.57], 'Japan': [139.69,35.69], 'Thailand': [100.5,13.76],
    'Vietnam': [105.85,21.03], 'Malaysia': [101.69,3.14], 'Philippines': [120.98,14.6], 'Indonesia': [106.85,-6.21], 'Kazakhstan': [71.43,51.13],
    'China': [116.4,39.9], 'Egypt': [31.24,30.04], 'Libya': [13.19,32.89], 'Algeria': [3.06,36.75], 'Morocco': [-6.84,34.02],
    'Sudan': [32.53,15.5], 'Ethiopia': [38.75,9.03], 'Nigeria': [7.49,9.06], 'Kenya': [36.82,-1.29], 'Angola': [13.23,-8.84],
    'Tanzania': [35.74,-6.16], 'Madagascar': [47.52,-18.88], 'South Africa': [28.19,-25.75], 'Greenland': [-51.72,64.18], 'Canada': [-75.7,45.42],
    'USA': [-77.04,38.9], 'Mexico': [-99.13,19.43], 'Colombia': [-74.07,4.71], 'Venezuela': [-66.9,10.48], 'Peru': [-77.04,-12.05],
    'Bolivia': [-68.15,-16.5], 'Brazil': [-47.88,-15.79], 'Argentina': [-58.38,-34.6], 'Chile': [-70.67,-33.45], 'Uruguay': [-56.16,-34.9],
    'Australia': [149.13,-35.28], 'New Zealand': [174.78,-41.29],
    // countries too small for a polygon of their own: a pin still stands where they are
    'Moldova': [28.86,47.01], 'Lithuania': [25.28,54.69], 'Latvia': [24.11,56.95], 'Estonia': [24.75,59.44], 'Georgia': [44.79,41.72],
    'Armenia': [44.51,40.18], 'Azerbaijan': [49.87,40.41], 'Bulgaria': [23.32,42.7], 'Serbia': [20.46,44.79], 'Slovakia': [17.11,48.15],
    'Slovenia': [14.51,46.06], 'Belarus': [27.56,53.9], 'Cyprus': [33.38,35.17], 'Iceland': [-21.9,64.15], 'Luxembourg': [6.13,49.61],
    'Malta': [14.51,35.9], 'Montenegro': [19.26,42.44], 'Albania': [19.82,41.33], 'North Macedonia': [21.43,42], 'Bosnia and Herzegovina': [18.41,43.86],
    'Uzbekistan': [69.24,41.3], 'Kyrgyzstan': [74.6,42.87], 'Singapore': [103.82,1.35], 'Taiwan': [121.56,25.03], 'Sri Lanka': [79.86,6.93],
    'Bangladesh': [90.41,23.81], 'Qatar': [51.53,25.29], 'Kuwait': [47.98,29.37], 'Jordan': [35.93,31.95], 'Lebanon': [35.5,33.89],
    'Tunisia': [10.18,36.81], 'Ghana': [-0.19,5.6], 'Senegal': [-17.47,14.72], 'Uganda': [32.58,0.35], 'Ecuador': [-78.47,-0.18],
    'Paraguay': [-57.58,-25.26], 'Cuba': [-82.37,23.11], 'Costa Rica': [-84.09,9.93], 'Panama': [-79.52,8.98], 'Dominican Republic': [-69.93,18.49],
  };
  const CITY = {
    'kyiv': [30.52,50.45], 'kiev': [30.52,50.45], 'lviv': [24.03,49.84], 'kharkiv': [36.23,49.99], 'odesa': [30.73,46.48], 'odessa': [30.73,46.48],
    'dnipro': [35.05,48.46], 'zaporizhzhia': [35.14,47.84], 'vinnytsia': [28.47,49.23], 'poltava': [34.55,49.59], 'chernihiv': [31.29,51.5],
    'ivano-frankivsk': [24.71,48.92], 'ternopil': [25.59,49.55], 'uzhhorod': [22.29,48.62], 'lutsk': [25.33,50.75], 'rivne': [26.25,50.62],
    'zhytomyr': [28.66,50.25], 'chernivtsi': [25.94,48.29], 'khmelnytskyi': [26.99,49.42], 'cherkasy': [32.06,49.44], 'sumy': [34.8,50.91],
    'mykolaiv': [31.99,46.98], 'kherson': [32.62,46.64], 'kropyvnytskyi': [32.26,48.51], 'kryvyi rih': [33.39,47.91], 'mariupol': [37.55,47.1],
    'warsaw': [21.01,52.23], 'krakow': [19.94,50.06], 'kraków': [19.94,50.06], 'wroclaw': [17.04,51.11], 'wrocław': [17.04,51.11], 'gdansk': [18.65,54.35],
    'gdańsk': [18.65,54.35], 'poznan': [16.93,52.41], 'poznań': [16.93,52.41], 'lodz': [19.46,51.76], 'łódź': [19.46,51.76], 'lublin': [22.57,51.25],
    'berlin': [13.4,52.52], 'munich': [11.58,48.14], 'hamburg': [9.99,53.55], 'frankfurt': [8.68,50.11], 'cologne': [6.96,50.94], 'dresden': [13.74,51.05],
    'prague': [14.42,50.09], 'brno': [16.61,49.2], 'vienna': [16.37,48.21], 'zurich': [8.54,47.38], 'geneva': [6.14,46.2], 'paris': [2.35,48.86],
    'lyon': [4.83,45.76], 'marseille': [5.37,43.3], 'nice': [7.26,43.7], 'london': [-0.13,51.5], 'manchester': [-2.24,53.48], 'edinburgh': [-3.19,55.95],
    'birmingham': [-1.9,52.49], 'dublin': [-6.26,53.35], 'madrid': [-3.7,40.42], 'barcelona': [2.17,41.39], 'valencia': [-0.38,39.47],
    'lisbon': [-9.14,38.72], 'porto': [-8.61,41.15], 'rome': [12.5,41.9], 'milan': [9.19,45.46], 'naples': [14.27,40.85], 'amsterdam': [4.9,52.37],
    'rotterdam': [4.48,51.92], 'brussels': [4.35,50.85], 'copenhagen': [12.57,55.68], 'oslo': [10.75,59.91], 'stockholm': [18.07,59.33],
    'helsinki': [24.94,60.17], 'tallinn': [24.75,59.44], 'riga': [24.11,56.95], 'vilnius': [25.28,54.69], 'chisinau': [28.86,47.01], 'chișinău': [28.86,47.01],
    'bucharest': [26.1,44.43], 'budapest': [19.04,47.5], 'sofia': [23.32,42.7], 'belgrade': [20.46,44.79], 'zagreb': [15.98,45.81], 'athens': [23.73,37.98],
    'istanbul': [28.98,41.01], 'ankara': [32.85,39.93], 'antalya': [30.71,36.9], 'tbilisi': [44.79,41.72], 'batumi': [41.64,41.64], 'yerevan': [44.51,40.18],
    'baku': [49.87,40.41], 'tel aviv': [34.78,32.08], 'jerusalem': [35.21,31.77], 'haifa': [34.99,32.79], 'dubai': [55.3,25.2], 'abu dhabi': [54.37,24.45],
    'doha': [51.53,25.29], 'riyadh': [46.68,24.71], 'cairo': [31.24,30.04], 'astana': [71.43,51.13], 'almaty': [76.95,43.24], 'tashkent': [69.24,41.3],
    'delhi': [77.21,28.61], 'new delhi': [77.21,28.61], 'mumbai': [72.88,19.08], 'bangalore': [77.59,12.97], 'beijing': [116.4,39.9], 'shanghai': [121.47,31.23],
    'hong kong': [114.17,22.32], 'shenzhen': [114.06,22.54], 'taipei': [121.56,25.03], 'seoul': [126.98,37.57], 'busan': [129.08,35.18], 'tokyo': [139.69,35.69],
    'osaka': [135.5,34.69], 'singapore': [103.82,1.35], 'bangkok': [100.5,13.76], 'hanoi': [105.85,21.03], 'ho chi minh city': [106.63,10.82],
    'kuala lumpur': [101.69,3.14], 'jakarta': [106.85,-6.21], 'bali': [115.19,-8.41], 'manila': [120.98,14.6], 'sydney': [151.21,-33.87],
    'melbourne': [144.96,-37.81], 'brisbane': [153.03,-27.47], 'perth': [115.86,-31.95], 'auckland': [174.76,-36.85], 'new york': [-74.01,40.71],
    'los angeles': [-118.24,34.05], 'chicago': [-87.63,41.88], 'san francisco': [-122.42,37.77], 'miami': [-80.19,25.76], 'boston': [-71.06,42.36],
    'seattle': [-122.33,47.61], 'washington': [-77.04,38.9], 'houston': [-95.37,29.76], 'toronto': [-79.38,43.65], 'montreal': [-73.57,45.5],
    'vancouver': [-123.12,49.28], 'calgary': [-114.07,51.05], 'ottawa': [-75.7,45.42], 'mexico city': [-99.13,19.43], 'sao paulo': [-46.63,-23.55],
    'são paulo': [-46.63,-23.55], 'rio de janeiro': [-43.17,-22.91], 'buenos aires': [-58.38,-34.6], 'santiago': [-70.67,-33.45], 'lima': [-77.04,-12.05],
    'bogota': [-74.07,4.71], 'bogotá': [-74.07,4.71], 'cape town': [18.42,-33.92], 'johannesburg': [28.05,-26.2], 'nairobi': [36.82,-1.29], 'lagos': [3.38,6.52],
  };
  const ALIAS = {
    'uk': 'United Kingdom', 'great britain': 'United Kingdom', 'britain': 'United Kingdom', 'england': 'United Kingdom', 'scotland': 'United Kingdom',
    'wales': 'United Kingdom', 'northern ireland': 'United Kingdom', 'us': 'USA', 'u.s.': 'USA', 'u.s.a.': 'USA', 'united states': 'USA',
    'united states of america': 'USA', 'america': 'USA', 'czech republic': 'Czechia', 'korea': 'South Korea', 'republic of korea': 'South Korea',
    'holland': 'Netherlands', 'the netherlands': 'Netherlands', 'türkiye': 'Turkey', 'turkiye': 'Turkey', 'united arab emirates': 'UAE', 'emirates': 'UAE',
    'macedonia': 'North Macedonia', 'bosnia': 'Bosnia and Herzegovina',
    'україна': 'Ukraine', 'украина': 'Ukraine', 'польща': 'Poland', 'польша': 'Poland', 'німеччина': 'Germany', 'германия': 'Germany',
    'сша': 'USA', 'канада': 'Canada', 'велика британія': 'United Kingdom', 'великобританія': 'United Kingdom', 'великобритания': 'United Kingdom',
    'англія': 'United Kingdom', 'англия': 'United Kingdom', 'іспанія': 'Spain', 'испания': 'Spain', 'італія': 'Italy', 'италия': 'Italy',
    'франція': 'France', 'франция': 'France', 'чехія': 'Czechia', 'чехия': 'Czechia', 'португалія': 'Portugal', 'португалия': 'Portugal',
    'нідерланди': 'Netherlands', 'нидерланды': 'Netherlands', 'ізраїль': 'Israel', 'израиль': 'Israel', 'туреччина': 'Turkey', 'турция': 'Turkey',
    'оае': 'UAE', 'оаэ': 'UAE', 'японія': 'Japan', 'япония': 'Japan', 'китай': 'China', 'казахстан': 'Kazakhstan', 'грузія': 'Georgia', 'грузия': 'Georgia',
    'молдова': 'Moldova', 'литва': 'Lithuania', 'латвія': 'Latvia', 'латвия': 'Latvia', 'естонія': 'Estonia', 'эстония': 'Estonia',
    'австрія': 'Austria', 'австрия': 'Austria', 'швейцарія': 'Switzerland', 'швейцария': 'Switzerland', 'ірландія': 'Ireland', 'ирландия': 'Ireland',
    'норвегія': 'Norway', 'норвегия': 'Norway', 'швеція': 'Sweden', 'швеция': 'Sweden', 'фінляндія': 'Finland', 'финляндия': 'Finland',
    'данія': 'Denmark', 'дания': 'Denmark', 'бельгія': 'Belgium', 'бельгия': 'Belgium', 'румунія': 'Romania', 'румыния': 'Romania',
    'угорщина': 'Hungary', 'венгрия': 'Hungary', 'греція': 'Greece', 'греция': 'Greece', 'хорватія': 'Croatia', 'хорватия': 'Croatia',
    'болгарія': 'Bulgaria', 'болгария': 'Bulgaria', 'словаччина': 'Slovakia', 'словакия': 'Slovakia', 'вірменія': 'Armenia', 'армения': 'Armenia',
    'азербайджан': 'Azerbaijan', 'кіпр': 'Cyprus', 'кипр': 'Cyprus', 'австралія': 'Australia', 'австралия': 'Australia', 'бразилія': 'Brazil', 'бразилия': 'Brazil',
    'мексика': 'Mexico', 'індія': 'India', 'индия': 'India', 'корея': 'South Korea', 'південна корея': 'South Korea', 'южная корея': 'South Korea',
  };
  const KNOWN = {};
  Object.keys(CAPITAL).forEach(k => { KNOWN[k.toLowerCase()] = k; });
  const NOT_NAMED = /^(russia|russian federation|rf|рф|росія|россия|рос\.? федерация)$/i;
  function countryName(raw) {
    const s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s || NOT_NAMED.test(s)) return null;
    const k = s.toLowerCase();
    return KNOWN[k] || ALIAS[k] || null;
  }
  function locate(country, city) {
    const cn = countryName(country);
    if (!cn) return null;
    const ck = String(city || '').trim().toLowerCase();
    const at = (ck && CITY[ck]) || CAPITAL[cn];
    return { country: cn, city: ck && CITY[ck] ? String(city).trim() : '', lon: at[0], lat: at[1] };
  }

  /* ---------- hub cities & arcs ---------- */
  const HUBS = [
    { n: 'New York', lon: -74, lat: 40.7 }, { n: 'Los Angeles', lon: -118.2, lat: 34 },
    { n: 'São Paulo', lon: -46.6, lat: -23.5 }, { n: 'London', lon: -0.1, lat: 51.5 },
    { n: 'Kyiv', lon: 30.5, lat: 50.4 }, { n: 'Dubai', lon: 55.3, lat: 25.2 },
    { n: 'Singapore', lon: 103.8, lat: 1.35 }, { n: 'Tokyo', lon: 139.7, lat: 35.7 },
    { n: 'Sydney', lon: 151.2, lat: -33.9 },
  ];
  const ARCS = [[0, 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8], [0, 1], [3, 5], [1, 0]];

  /* ---------- palettes ---------- */
  const THEMES = {
    ink: { bg: ['#090D18', '#131B31'], land: [232, 230, 217], landA: .92, oceanA: .055, accent: '#D3F26A', accentRGB: '211,242,106', arc: 'rgba(211,242,106,.34)', pinTx: '#0B1026', labelTx: '#0B1026' },
    sand: { bg: ['#F4F1E4', '#E8E3CF'], land: [38, 42, 46], landA: .88, oceanA: .07, accent: '#6E8B0E', accentRGB: '110,139,14', arc: 'rgba(110,139,14,.38)', pinTx: '#FFFFFF', labelTx: '#FFFFFF' },
    silver: { bg: ['#EFF2F6', '#D7DEE9'], land: [35, 45, 64], landA: .9, oceanA: .07, accent: '#4E7A0A', accentRGB: '78,122,10', arc: 'rgba(78,122,10,.34)', pinTx: '#FFFFFF', labelTx: '#FFFFFF' },
  };
  const STUD_RGB = [183, 156, 255], STUD_HEX = '#B79CFF', STUD_TX = '#241A3F';

  let cv = null, ctx = null, host = null, raf = 0, last = 0, ro = null, labelEl = null, cityEl = null;
  let theme = THEMES.ink, opts = {};
  let W = 0, H = 0, dots = [], GAP = 15, mapX0 = 0, mapY0 = 0, mapW = 1, mapH = 1, t = 0;
  const mouse = { x: -999, y: -999, bare: false };
  let ripples = [], visited = [], visitedSet = new Set(), feed = [], journalSet = new Set(), journalCities = [], pins = [];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const proj = (lon, lat) => [mapX0 + (lon + 180) / 360 * mapW, mapY0 + (82 - lat) / 148 * mapH];
  const unproj = (x, y) => [(x - mapX0) / mapW * 360 - 180, 82 - (y - mapY0) / mapH * 148];
  const inMap = (x, y) => x > mapX0 && x < mapX0 + mapW && y > mapY0 && y < mapY0 + mapH;

  function build() {
    if (!cv) return;
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // #desktop runs past the bottom of the window: the map sits in the part you can see
    const vis = Math.max(200, Math.min(H, window.innerHeight - Math.max(0, r.top)));
    mapW = Math.min(W * .94, 1500); mapH = mapW * (148 / 360) * 1.32;
    if (mapH > vis * .78) { mapH = vis * .78; mapW = mapH / 1.32 * (360 / 148); }
    mapX0 = (W - mapW) / 2; mapY0 = vis * .5 - mapH / 2;
    GAP = mapW > 1100 ? 15 : 13;
    dots = [];
    for (let y = 6; y < H - 6; y += GAP) for (let x = 6; x < W - 6; x += GAP) {
      const [lon, lat] = unproj(x, y);
      const land = inMap(x, y) ? isLandEff(lon, lat) : false;
      dots.push({ x, y, land, c: land ? findCountry(lon, lat) : null, ph: Math.random() * Math.PI * 2, sp: .5 + Math.random() * 1.1, tw: Math.random() < .05 });
    }
    HUBS.forEach(c => { [c.x, c.y] = proj(c.lon, c.lat); });
    clusterPins();
    draw(0);
  }

  function pill(text, x, y, bg, tx, below) {
    ctx.font = '800 11px Manrope, system-ui, sans-serif';
    const pw = ctx.measureText(text).width + 18, ph = 20, px = x - pw / 2, py = below ? y + 12 : y - 34;
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 10); else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.fillStyle = tx; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, py + ph / 2 + .5);
    ctx.beginPath();
    if (below) { ctx.moveTo(x - 4, py); ctx.lineTo(x + 4, py); ctx.lineTo(x, y + 5); }
    else { ctx.moveTo(x - 4, py + ph); ctx.lineTo(x + 4, py + ph); ctx.lineTo(x, y - 6); }
    ctx.closePath(); ctx.fillStyle = bg; ctx.fill();
  }

  function draw(dt) {
    if (!ctx) return;
    t = reduced() ? 2.2 : t + dt / 1000;
    const g = ctx.createLinearGradient(0, 0, W * .35, H);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    let hover = null;
    if (mouse.bare && inMap(mouse.x, mouse.y)) {
      const [lon, lat] = unproj(mouse.x, mouse.y);
      if (isLandEff(lon, lat)) hover = findCountry(lon, lat);
      if (hover && hover.n === HIDDEN) hover = null;
    }
    ripples = ripples.filter(r => t - r.t0 < 1.6);
    const acc = theme.accentRGB.split(',').map(Number);
    for (const d of dots) {
      const md = Math.hypot(d.x - mouse.x, d.y - mouse.y);
      const boost = md < 130 ? Math.pow(1 - md / 130, 2) : 0;
      let rip = 0;
      for (const r of ripples) {
        const age = (t - r.t0) * 260, rd = Math.hypot(d.x - r.x, d.y - r.y);
        rip = Math.max(rip, Math.exp(-Math.abs(rd - age) / 26) * Math.max(0, 1 - age / 620));
      }
      const wave = .5 + .5 * Math.sin(t * d.sp + d.ph + (d.x + d.y) * .004);
      if (d.land) {
        let a = Math.min(1, theme.landA * (.45 + .55 * wave) + boost * .4 + rip * .5);
        const s = 1.5 + wave * .9 + boost * 2.4 + rip * 3;
        let mix = Math.min(1, boost * 1.2 + rip * 1.3), mc = acc;
        if (d.c && visitedSet.has(d.c.n) && mix < .3) mix = .3;
        if (d.c && journalSet.has(d.c.n)) { mix = Math.max(mix, .42); mc = STUD_RGB; }
        if (d.c && hover && d.c.n === hover.n) { mix = Math.max(mix, .9); mc = acc; a = Math.min(1, a + .3); }
        const L = theme.land;
        ctx.fillStyle = `rgba(${Math.round(L[0] + (mc[0] - L[0]) * mix)},${Math.round(L[1] + (mc[1] - L[1]) * mix)},${Math.round(L[2] + (mc[2] - L[2]) * mix)},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, s, 0, 7); ctx.fill();
        if (d.tw && wave > .93) { ctx.fillStyle = `rgba(${theme.accentRGB},.5)`; ctx.fillRect(d.x - 5, d.y - .7, 10, 1.4); ctx.fillRect(d.x - .7, d.y - 5, 1.4, 10); }
      } else {
        const a = theme.oceanA + boost * .12 + rip * .15;
        ctx.fillStyle = `rgba(${theme.land[0]},${theme.land[1]},${theme.land[2]},${a.toFixed(3)})`;
        ctx.fillRect(d.x - 1, d.y - 1, 2, 2);
      }
    }

    // arcs between the hubs, then the hubs
    ctx.lineWidth = 1.1;
    for (const [ai, bi] of ARCS) {
      const A = HUBS[ai], B = HUBS[bi];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - Math.hypot(B.x - A.x, B.y - A.y) * .22;
      ctx.strokeStyle = theme.arc; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 22;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(mx, my, B.x, B.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    let hub = null;
    for (const c of HUBS) {
      const pulse = .5 + .5 * Math.sin(t * 2 + c.lon);
      ctx.strokeStyle = `rgba(${theme.accentRGB},${(.55 * (1 - pulse)).toFixed(3)})`;
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c.x, c.y, 4 + pulse * 9, 0, 7); ctx.stroke();
      ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(c.x, c.y, 2.6, 0, 7); ctx.fill();
      if (mouse.bare && Math.hypot(c.x - mouse.x, c.y - mouse.y) < 16) hub = c;
    }

    // visited: a lime pin with the country's name above it
    for (const v of visited) {
      const [x, y] = proj(v.lon, v.lat);
      const pulse = .5 + .5 * Math.sin(t * 2 + v.lon);
      ctx.strokeStyle = `rgba(${theme.accentRGB},${(.5 * (1 - pulse)).toFixed(3)})`;
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 8, 0, 7); ctx.stroke();
      ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      pill(v.n, x, y, theme.accent, theme.pinTx, false);
    }
    // students from the Journal: one violet pin per city (cities closer than a label merge), the label below
    for (const jc of pins) {
      const { x, y } = jc;
      const pulse = .5 + .5 * Math.sin(t * 2 + jc.lon * 1.7);
      ctx.strokeStyle = `rgba(${STUD_RGB.join(',')},${(.55 * (1 - pulse)).toFixed(3)})`;
      ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, 5 + pulse * 9, 0, 7); ctx.stroke();
      ctx.fillStyle = STUD_HEX; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill();
      pill(jc.label, x, y, STUD_HEX, STUD_TX, true);
    }
    for (const r of ripples) {
      const age = (t - r.t0) * 260;
      ctx.strokeStyle = `rgba(${theme.accentRGB},${Math.max(0, .5 - age / 620 * .5).toFixed(3)})`;
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(r.x, r.y, age, 0, 7); ctx.stroke();
    }

    // the labels live in the DOM, under the windows
    if (cityEl) {
      cityEl.style.opacity = hub ? 1 : 0;
      if (hub) { cityEl.textContent = hub.n; cityEl.style.left = hub.x + 'px'; cityEl.style.top = hub.y + 'px'; cityEl.style.color = theme.accent; }
    }
    if (labelEl) {
      if (hover && !hub) {
        const marks = [];
        if (visitedSet.has(hover.n)) marks.push('visited');
        const names = feed.filter(s => s.country === hover.n).map(s => s.student);
        if (names.length) marks.push(names.join(', '));
        labelEl.textContent = hover.n + (marks.length ? ' · ' + marks.join(' · ') : '');
        labelEl.style.left = mouse.x + 'px'; labelEl.style.top = mouse.y + 'px';
        labelEl.style.background = names.length ? STUD_HEX : theme.accent;
        labelEl.style.color = names.length ? STUD_TX : theme.labelTx;
        labelEl.style.opacity = 1;
      } else labelEl.style.opacity = 0;
    }
    if (host) host.style.cursor = mouse.bare && (hover || hub) ? 'pointer' : '';
  }

  function loop(tms) {
    raf = 0;
    if (!cv || document.hidden) return;
    if (tms - last >= FRAME_MS) { draw(last ? Math.min(100, tms - last) : 16); last = tms; }
    if (!reduced()) raf = requestAnimationFrame(loop);
  }
  function wake() { if (cv && !raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } }

  function onMove(e) {
    if (!host) return;
    const s = host.getBoundingClientRect();
    mouse.x = e.clientX - s.left; mouse.y = e.clientY - s.top;
    // only the bare desktop answers: not a window, a widget or the dock over it
    mouse.bare = e.target === host || e.target === cv;
    if (reduced()) wake();
  }
  function onLeave() { mouse.x = mouse.y = -999; mouse.bare = false; if (reduced()) wake(); }
  function onClick(e) {
    if (e.target !== host) return;
    const s = host.getBoundingClientRect();
    const x = e.clientX - s.left, y = e.clientY - s.top;
    ripples.push({ x, y, t0: t });
    if (inMap(x, y)) {
      const [lon, lat] = unproj(x, y);
      const c = isLandEff(lon, lat) ? findCountry(lon, lat) : null;
      if (c && c.n !== HIDDEN) {
        const i = visited.findIndex(v => v.n === c.n);
        if (i >= 0) visited.splice(i, 1); else visited.push({ n: c.n, lon: Math.round(lon * 10) / 10, lat: Math.round(lat * 10) / 10 });
        visitedSet = new Set(visited.map(v => v.n));
        if (typeof opts.onVisited === 'function') opts.onVisited(visited.slice());
      }
    }
    wake();
  }

  function setFeed(list) {
    feed = (list || []).map(s => { const at = locate(s.country, s.city); return at ? { student: s.student, ...at } : null; }).filter(Boolean);
    journalSet = new Set(feed.map(s => s.country));
    const by = {};
    for (const s of feed) { const k = (s.city || '') + '|' + s.country; (by[k] = by[k] || { city: s.city, country: s.country, lon: s.lon, lat: s.lat, names: [] }).names.push(s.student); }
    journalCities = Object.values(by);
    clusterPins();
    if (cv) wake();
  }
  /* At this scale Warsaw, Kraków and Berlin are a few pixels apart: pins closer
     than a label merge into one - the biggest city names it, "+N" counts the rest. */
  function clusterPins() {
    if (!mapW) return;
    const pts = journalCities.map(c => { const [x, y] = proj(c.lon, c.lat); return { ...c, x, y }; })
      .sort((a, b) => b.names.length - a.names.length);
    const out = [];
    for (const c of pts) {
      const near = out.find(o => Math.abs(o.x - c.x) < 64 && Math.abs(o.y - c.y) < 26);
      if (near) { near.names.push(...c.names); near.more++; } else out.push({ ...c, names: c.names.slice(), more: 0 });
    }
    out.forEach(o => {
      o.label = (o.city || o.country) + (o.more ? ` +${o.more}` : '') + (o.names.length > 1 ? ' · ' + o.names.length : '');
    });
    pins = out;
  }
  function setVisited(list) {
    visited = (Array.isArray(list) ? list : []).filter(v => v && typeof v.n === 'string' && isFinite(v.lon) && isFinite(v.lat) && v.n !== HIDDEN);
    visitedSet = new Set(visited.map(v => v.n));
    if (cv) wake();
  }

  function mount(el, o = {}) {
    if (!el) return;
    opts = o;
    theme = THEMES[o.theme] || THEMES.ink;
    if (o.visited) setVisited(o.visited);
    if (cv && host === el) { wake(); return; }
    unmount();
    host = el;
    cv = document.createElement('canvas');
    cv.className = 'world-map-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
    host.prepend(cv);
    ctx = cv.getContext('2d');
    const mk = (cls, css) => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); d.style.cssText = css; host.appendChild(d); return d; };
    const base = 'position:absolute;z-index:1;pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap;font-family:Manrope,system-ui,sans-serif;font-weight:800;';
    cityEl = mk('world-map-hub', base + 'font-size:10px;letter-spacing:1.4px;text-transform:uppercase;transform:translate(10px,-16px)');
    labelEl = mk('world-map-label', base + 'font-size:12.5px;padding:6px 13px;border-radius:999px;transform:translate(-50%,-280%);box-shadow:0 6px 22px rgba(0,0,0,.28)');
    build();
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', wake);
    ro = new ResizeObserver(() => build());
    ro.observe(host);
    wake();
  }
  function unmount() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) { ro.disconnect(); ro = null; }
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', wake);
    if (host) { host.removeEventListener('click', onClick); host.style.cursor = ''; }
    cv?.remove(); labelEl?.remove(); cityEl?.remove();
    cv = null; ctx = null; host = null; labelEl = null; cityEl = null; dots = []; ripples = [];
    mouse.bare = false;
  }
  const NAMES = Object.keys(CAPITAL).sort();
  window.TeachedWorld = { mount, unmount, setFeed, setVisited, locate, countryName, countries: NAMES };
})();
