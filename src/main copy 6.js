import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import colorMap from './earth_color_10K.png';
import specularMap from './specular_map_8k.png';

// --- Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100000);
camera.position.set(0, 0, 3000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1000;
controls.maxDistance = 50000;

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff,0.6));
const dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(5000,5000,5000);
scene.add(dirLight);

// --- HTML UI ---
const waypointContainer = document.createElement('div');
waypointContainer.style.position='absolute';
waypointContainer.style.top='0';
waypointContainer.style.left='0';
waypointContainer.style.pointerEvents='none';
document.body.appendChild(waypointContainer);

const topoSlider = document.createElement('input');
topoSlider.type='range'; topoSlider.min='0'; topoSlider.max='50'; topoSlider.step='0.1'; topoSlider.value='10';
topoSlider.style.position='absolute'; topoSlider.style.top='10px'; topoSlider.style.left='10px'; topoSlider.style.zIndex='10';
document.body.appendChild(topoSlider);

const launchBtn = document.createElement('button');
launchBtn.textContent='Launch Asteroid';
launchBtn.style.position='absolute'; launchBtn.style.top='40px'; launchBtn.style.left='10px'; launchBtn.style.zIndex='10';
document.body.appendChild(launchBtn);

// --- Variables ---
let waypoint=null, asteroid=null, impactEffect=null, countriesData=[];
let craterPosition=new THREE.Vector3(), craterRadius=0, craterDepth=0;
let craterTargetDepth=0, craterGrowing=false;

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Load countries.json ---
fetch('./countries.json').then(res=>res.json()).then(data=>countriesData=data);

// --- Load textures and create shader Earth ---
const loader = new THREE.TextureLoader();
loader.load(colorMap, colorTexture=>{
  loader.load(specularMap, specTexture=>{

    const EARTH_RADIUS = 1000;
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 256, 256);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: colorTexture },
        specularMap: { value: specTexture },
        displacementScale: { value: parseFloat(topoSlider.value) },
        craterPos: { value: new THREE.Vector3() },
        craterRadius: { value: 0 },
        craterDepth: { value: 0 },
      },
// vertex shader
vertexShader: `
  uniform sampler2D colorMap;
  uniform float displacementScale;
  uniform vec3 craterPos;
  uniform float craterRadius;
  uniform float craterDepth;
  varying vec2 vUv;
  varying float vCrater;
  void main() {
    vUv = uv;
    vec3 pos = position;
    vec3 worldPos = (modelMatrix * vec4(position,1.0)).xyz;
    float dist = distance(worldPos, craterPos);
    
    // base displacement from topography
    float disp = texture2D(colorMap, uv).r * displacementScale;

    // crater displacement
    float craterEffect = 0.0;
    if(dist < craterRadius){
      float x = dist / craterRadius;
      craterEffect = craterDepth * (1.0 - x*x); // smooth parabolic depression
    }

    vCrater = craterEffect; // pass crater effect to fragment shader
    pos += normal * (disp - craterEffect);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
  }
`,

// fragment shader
fragmentShader: `
  uniform sampler2D colorMap;
  varying vec2 vUv;
  varying float vCrater;
  void main(){
    vec3 baseColor = texture2D(colorMap, vUv).rgb;

    // only modify color if we are inside the crater
    vec3 craterColor = baseColor;
    if(vCrater > 0.0){
      float t = vCrater / 50.0; // normalize depth for coloring
      t = clamp(t, 0.0, 1.0);
      // gradient: deep->brown, mid->red, shallow->yellow
      craterColor = mix(vec3(0.6,0.3,0.1), vec3(0.8,0.2,0.1), t); 
      craterColor = mix(craterColor, vec3(1.0,1.0,0.0), smoothstep(0.0,1.0,t));
    }

    gl_FragColor = vec4(craterColor,1.0);
  }
`,

    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // --- Helper Functions ---
    function posToLatLon(pos){
      const r = pos.length();
      return {
        lat: THREE.MathUtils.radToDeg(Math.asin(pos.y/r)),
        lon: THREE.MathUtils.radToDeg(Math.atan2(pos.z,pos.x))
      };
    }
    function toScreenPosition(pos){
      const vector = pos.clone().project(camera);
      return { x:(vector.x+1)/2*window.innerWidth, y:(-vector.y+1)/2*window.innerHeight };
    }
    function haversine(lat1,lon1,lat2,lon2){
      const R=6371;
      const dLat = THREE.MathUtils.degToRad(lat2-lat1);
      const dLon = THREE.MathUtils.degToRad(lon2-lon1);
      const a = Math.sin(dLat/2.0)*Math.sin(dLat/2.0) + Math.cos(THREE.MathUtils.degToRad(lat1))*Math.cos(THREE.MathUtils.degToRad(lat2))*Math.sin(dLon/2.0)*Math.sin(dLon/2.0);
      return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1.0-a));
    }
    function findNearestCountry(lat,lon){
      if(!countriesData.length) return 'Unknown';
      let closest=countriesData[0], minDist=haversine(lat,lon,closest.Latitude,closest.Longitude);
      for(let i=1;i<countriesData.length;i++){
        const d=haversine(lat,lon,countriesData[i].Latitude,countriesData[i].Longitude);
        if(d<minDist){ minDist=d; closest=countriesData[i]; }
      }
      return closest.Country;
    }

    // --- Click Handler ---
    renderer.domElement.addEventListener('mousedown',event=>{
      if(event.button!==0) return;
      mouse.x = (event.clientX/window.innerWidth)*2-1;
      mouse.y = -(event.clientY/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const intersects = raycaster.intersectObject(earth);
      if(intersects.length>0){
        const point = intersects[0].point;
        const {lat,lon} = posToLatLon(point);
        const country = findNearestCountry(lat,lon);

        if(waypoint){ waypoint.el.remove(); scene.remove(waypoint.mesh); }

        // Pin
        const pinHeight=30;
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(5,pinHeight,16), new THREE.MeshBasicMaterial({color:0xff0000}));
        mesh.rotation.x = Math.PI; mesh.position.copy(point); mesh.position.y += pinHeight/2; scene.add(mesh);

        const el=document.createElement('div');
        el.style.position='absolute'; el.style.background='rgba(255,255,255,0.8)'; el.style.padding='2px 5px'; el.style.borderRadius='4px';
        el.style.fontFamily='sans-serif'; el.style.fontSize='12px'; el.style.color='#000'; el.style.pointerEvents='auto';
        el.innerHTML=`📍 Lat:${lat.toFixed(2)}°, Lon:${lon.toFixed(2)}°<br>${country}`;
        waypointContainer.appendChild(el);
        waypoint={mesh,el,position:point};

        // Crater target
        craterPosition.copy(point);
        craterRadius = parseFloat(topoSlider.value) * 4.0; // scale for visible crater
        craterTargetDepth = 50; // max crater depth
        craterGrowing = true;
      }
    });

    // --- Launch button ---
    launchBtn.addEventListener('click', ()=>{
      if(!waypoint) return;
      if(asteroid) scene.remove(asteroid);
      asteroid = new THREE.Mesh(new THREE.SphereGeometry(20,16,16), new THREE.MeshPhongMaterial({color:0x555555}));
      const dir = new THREE.Vector3().subVectors(waypoint.position,camera.position).normalize();
      asteroid.position.copy(camera.position).add(dir.multiplyScalar(5000));
      asteroid.userData.target = waypoint.position.clone();
      scene.add(asteroid);
    });

    // --- Animate ---
    function animate(){
      requestAnimationFrame(animate);
      controls.update();

      if(waypoint){
        const screenPos = toScreenPosition(waypoint.position);
        waypoint.el.style.left = `${screenPos.x}px`;
        waypoint.el.style.top = `${screenPos.y}px`;
      }

      // Asteroid motion
      if(asteroid){
        const target = asteroid.userData.target;
        const dir = new THREE.Vector3().subVectors(target,asteroid.position);
        const dist = dir.length(); dir.normalize(); const speed = 50;
        if(dist>10) asteroid.position.add(dir.multiplyScalar(speed));
        else { asteroid=null; craterGrowing=true; }
      }

      // Animate crater depth
      if(craterGrowing){
        craterDepth += 1.0;
        if(craterDepth >= craterTargetDepth){ craterDepth = craterTargetDepth; craterGrowing=false; }
        material.uniforms.craterPos.value.copy(craterPosition);
        material.uniforms.craterRadius.value = craterRadius;
        material.uniforms.craterDepth.value = craterDepth;
      }

      // Update topo scale
      material.uniforms.displacementScale.value = parseFloat(topoSlider.value);

      renderer.render(scene,camera);
    }

    animate();
  });
});

// --- Resize ---
window.addEventListener('resize',()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
