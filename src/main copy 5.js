import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import colorMap from './earth_color_10K.png';
import specularMap from './specular_map_8k.png';

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100000);
camera.position.set(0, 0, 3000);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1000;
controls.maxDistance = 50000;

// --- Lights ---
scene.add(new THREE.AmbientLight(0xffffff,0.6));
const dirLight = new THREE.DirectionalLight(0xffffff,1);
dirLight.position.set(5000,5000,5000);
scene.add(dirLight);

// --- HTML containers ---
const waypointContainer = document.createElement('div');
waypointContainer.style.position = 'absolute';
waypointContainer.style.top = '0';
waypointContainer.style.left = '0';
waypointContainer.style.pointerEvents = 'none';
document.body.appendChild(waypointContainer);

// --- Slider for topography height ---
const topoSlider = document.createElement('input');
topoSlider.type = 'range';
topoSlider.min = 0;
topoSlider.max = 50;
topoSlider.step = 0.1;
topoSlider.value = 10;
topoSlider.style.position = 'absolute';
topoSlider.style.top = '10px';
topoSlider.style.left = '10px';
topoSlider.style.zIndex = '10';
document.body.appendChild(topoSlider);

// --- Launch button ---
const launchBtn = document.createElement('button');
launchBtn.textContent = 'Launch Asteroid';
launchBtn.style.position = 'absolute';
launchBtn.style.top = '40px';
launchBtn.style.left = '10px';
launchBtn.style.zIndex = '10';
document.body.appendChild(launchBtn);

// --- Variables ---
let waypoint = null;
let asteroid = null;
let impactEffect = null;
let countriesData = [];
let craterData = {position: new THREE.Vector3(0,0,0), radius:0};

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Load countries.json ---
fetch('./countries.json')
  .then(res=>res.json())
  .then(data=>countriesData = data);

// --- Load Earth textures ---
const loader = new THREE.TextureLoader();
loader.load(colorMap, colorTexture => {
  loader.load(specularMap, specTexture => {

    const EARTH_RADIUS = 1000;
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS,256,256);
    
    const material = new THREE.MeshPhongMaterial({
      map: colorTexture,
      displacementMap: colorTexture,
      displacementScale: parseFloat(topoSlider.value),
      specularMap: specTexture,
      specular: new THREE.Color(0x888888),
      shininess:50,
    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // --- Helper Functions ---
    function posToLatLon(pos){
      const r = pos.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(pos.y/r));
      const lon = THREE.MathUtils.radToDeg(Math.atan2(pos.z,pos.x));
      return {lat,lon};
    }

    function toScreenPosition(pos){
      const vector = pos.clone().project(camera);
      return {
        x:(vector.x+1)/2*window.innerWidth,
        y:(-vector.y+1)/2*window.innerHeight
      };
    }

    function haversine(lat1,lon1,lat2,lon2){
      const R=6371;
      const dLat = THREE.MathUtils.degToRad(lat2-lat1);
      const dLon = THREE.MathUtils.degToRad(lon2-lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(THREE.MathUtils.degToRad(lat1))*Math.cos(THREE.MathUtils.degToRad(lat2))*Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      return R*c;
    }

    function findNearestCountry(lat,lon){
      if(!countriesData.length) return 'Unknown';
      let closest = countriesData[0];
      let minDist = haversine(lat,lon,closest.Latitude,closest.Longitude);
      for(let i=1;i<countriesData.length;i++){
        const d = haversine(lat,lon,countriesData[i].Latitude,countriesData[i].Longitude);
        if(d<minDist){
          minDist = d;
          closest = countriesData[i];
        }
      }
      return closest.Country;
    }

    // --- Click Handler ---
    renderer.domElement.addEventListener('mousedown', event=>{
      if(event.button!==0) return;

      mouse.x = (event.clientX/window.innerWidth)*2-1;
      mouse.y = -(event.clientY/window.innerHeight)*2+1;

      raycaster.setFromCamera(mouse,camera);
      const intersects = raycaster.intersectObject(earth);
      if(intersects.length>0){
        const point = intersects[0].point;
        const {lat,lon} = posToLatLon(point);
        const country = findNearestCountry(lat,lon);

        // Remove old waypoint
        if(waypoint){
          waypoint.el.remove();
          scene.remove(waypoint.mesh);
        }

        // --- Pin ---
        const pinHeight = 30;
        const pinGeo = new THREE.ConeGeometry(5,pinHeight,16);
        const pinMat = new THREE.MeshBasicMaterial({color:0xff0000});
        const mesh = new THREE.Mesh(pinGeo,pinMat);
        mesh.rotation.x = Math.PI;
        mesh.position.copy(point);
        mesh.position.y += pinHeight/2;
        scene.add(mesh);

        // --- Label ---
        const el = document.createElement('div');
        el.style.position='absolute';
        el.style.background='rgba(255,255,255,0.8)';
        el.style.padding='2px 5px';
        el.style.borderRadius='4px';
        el.style.fontFamily='sans-serif';
        el.style.fontSize='12px';
        el.style.color='#000';
        el.style.pointerEvents='auto';
        el.innerHTML = `📍 Lat:${lat.toFixed(2)}°, Lon:${lon.toFixed(2)}°<br>${country}`;
        waypointContainer.appendChild(el);

        waypoint={mesh,el,position:point};

        // --- Save crater data ---
        craterData.position.copy(point);
        craterData.radius = 0; // start small, can link to slider later
      }
    });

    // --- Launch Button ---
    launchBtn.addEventListener('click', ()=>{
      if(!waypoint) return;
      if(asteroid) scene.remove(asteroid);

      asteroid = new THREE.Mesh(
        new THREE.SphereGeometry(20,16,16),
        new THREE.MeshPhongMaterial({color:0x555555})
      );
      const dir = new THREE.Vector3().subVectors(waypoint.position,camera.position).normalize();
      asteroid.position.copy(camera.position).add(dir.multiplyScalar(5000));
      asteroid.userData.target = waypoint.position.clone();
      scene.add(asteroid);
    });

    // --- Animate ---
    function animate(){
      requestAnimationFrame(animate);
      controls.update();

      // Update waypoint label
      if(waypoint){
        const screenPos = toScreenPosition(waypoint.position);
        waypoint.el.style.left = `${screenPos.x}px`;
        waypoint.el.style.top = `${screenPos.y}px`;
      }

      // Asteroid motion
      if(asteroid){
        const target = asteroid.userData.target;
        const dir = new THREE.Vector3().subVectors(target,asteroid.position);
        const distance = dir.length();
        dir.normalize();
        const speed = 50;
        if(distance>10){
          asteroid.position.add(dir.multiplyScalar(speed));
        } else {
          if(!impactEffect){
            impactEffect = new THREE.Mesh(
              new THREE.SphereGeometry(50,32,32),
              new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.8})
            );
            impactEffect.position.copy(target);
            scene.add(impactEffect);
          }
          scene.remove(asteroid);
          asteroid=null;

          if(impactEffect.material.opacity>0){
            impactEffect.scale.addScalar(0.5);
            impactEffect.material.opacity-=0.02;
          } else {
            scene.remove(impactEffect);
            impactEffect=null;
          }
        }
      }

      // Update topography scale from slider
      material.displacementScale = parseFloat(topoSlider.value);

      renderer.render(scene,camera);
    }

    animate();
  });
});

// --- Resize ---
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
