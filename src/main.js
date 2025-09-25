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
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5000,5000,5000);
scene.add(dirLight);

// --- HTML UI ---
const waypointContainer = document.createElement('div');
waypointContainer.style.position = 'absolute';
waypointContainer.style.top = '0';
waypointContainer.style.left = '0';
waypointContainer.style.pointerEvents = 'none';
document.body.appendChild(waypointContainer);

const topoSlider = document.createElement('input');
topoSlider.type='range'; topoSlider.min='0'; topoSlider.max='500'; topoSlider.step='0.01'; topoSlider.value='10';
topoSlider.style.position='absolute'; topoSlider.style.top='10px'; topoSlider.style.left='10px'; topoSlider.style.zIndex='10';
document.body.appendChild(topoSlider);

const launchBtn = document.createElement('button');
launchBtn.textContent='Launch Asteroid';
launchBtn.style.position='absolute'; launchBtn.style.top='40px'; launchBtn.style.left='10px'; launchBtn.style.zIndex='10';
document.body.appendChild(launchBtn);

// --- Variables ---
let waypoint = null, asteroid = null, craterGrowing=false;
let craterPos = new THREE.Vector3();
let craterRadius = 0, craterDepth = 0, craterTargetDepth = 0;

// --- Raycaster ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Load Earth Textures ---
const loader = new THREE.TextureLoader();
loader.load(colorMap, colorTexture=>{
  loader.load(specularMap, specTexture=>{

    const EARTH_RADIUS = 1000;
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 256, 256);

    // --- Shader Material for Earth with crater ---
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: colorTexture },
        specMap: { value: specTexture },
        displacementScale: { value: parseFloat(topoSlider.value) },
        craterPos: { value: craterPos },
        craterRadius: { value: 0 },
        craterDepth: { value: 0 },
      },
      vertexShader: `
        uniform sampler2D colorMap;
        uniform float displacementScale;
        uniform vec3 craterPos;
        uniform float craterRadius;
        uniform float craterDepth;
        varying vec2 vUv;
        varying float vCraterDepth;
        void main(){
          vUv = uv;
          vec3 pos = position;
          vec3 worldPos = (modelMatrix * vec4(position,1.0)).xyz;
          float dist = distance(worldPos, craterPos);

          float baseDisp = texture2D(colorMap, uv).r * displacementScale;

          float craterEffect = 0.0;
          if(dist < craterRadius){
            float x = dist / craterRadius;
            craterEffect = craterDepth * (1.0 - x*x); // smooth parabolic
          }
          vCraterDepth = craterEffect;

          pos += normal * (baseDisp - craterEffect);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D colorMap;
        varying vec2 vUv;
        varying float vCraterDepth;
        void main(){
          vec3 base = texture2D(colorMap, vUv).rgb;

          if(vCraterDepth > 0.01){
            float t = clamp(vCraterDepth/50.0, 0.0, 1.0);
            vec3 craterCol = mix(vec3(0.6,0.3,0.1), vec3(0.8,0.2,0.1), t); // brown->red
            craterCol = mix(craterCol, vec3(1.0,0.8,0.2), smoothstep(0.0,1.0,t)); // red->yellow
            base = mix(base, craterCol, t);

            // Shadow effect inside crater
            float shadow = 1.0 - smoothstep(0.0,1.0,t)*0.5;
            base *= shadow;
          }

          gl_FragColor = vec4(base,1.0);
        }
      `,
    });

    const earth = new THREE.Mesh(earthGeo, earthMat);
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

    // --- Click Handler to set waypoint ---
    renderer.domElement.addEventListener('mousedown', event=>{
      if(event.button!==0) return;
      mouse.x = (event.clientX/window.innerWidth)*2-1;
      mouse.y = -(event.clientY/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const intersects = raycaster.intersectObject(earth);
      if(intersects.length>0){
        const point = intersects[0].point;

        if(waypoint){ waypoint.el.remove(); scene.remove(waypoint.mesh); }

        // Pin
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(5,30,16), new THREE.MeshBasicMaterial({color:0xff0000}));
        mesh.rotation.x = Math.PI; mesh.position.copy(point); mesh.position.y += 15;
        scene.add(mesh);

        const el = document.createElement('div');
        el.style.position='absolute'; el.style.background='rgba(255,255,255,0.8)';
        el.style.padding='2px 5px'; el.style.borderRadius='4px'; el.style.fontFamily='sans-serif';
        el.style.fontSize='12px'; el.style.color='#000'; el.style.pointerEvents='auto';
        el.innerHTML = `📍 Lat:${posToLatLon(point).lat.toFixed(2)}°, Lon:${posToLatLon(point).lon.toFixed(2)}°`;
        waypointContainer.appendChild(el);

        waypoint={mesh, el, position:point};
      }
    });

    // --- Launch asteroid ---
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

      // Set crater target for animation
      craterPos.copy(waypoint.position);
      craterRadius = parseFloat(topoSlider.value)*4.0;
      craterTargetDepth = 50;
      craterDepth = 0;
      craterGrowing = true;
    });

    // --- Animate ---
    function animate(){
      requestAnimationFrame(animate);
      controls.update();

      if(waypoint){
        const sp = toScreenPosition(waypoint.position);
        waypoint.el.style.left = `${sp.x}px`;
        waypoint.el.style.top = `${sp.y}px`;
      }

      // Asteroid motion
      if(asteroid){
        const target = asteroid.userData.target;
        const dir = new THREE.Vector3().subVectors(target,asteroid.position);
        const dist = dir.length(); dir.normalize();
        const speed = 50;
        if(dist > 10){
          asteroid.position.add(dir.multiplyScalar(speed));
        } else {
          asteroid = null; // asteroid reached Earth
        }
      }

      // Animate crater depth
      if(craterGrowing){
        craterDepth += 1.0;
        if(craterDepth >= craterTargetDepth){ craterDepth = craterTargetDepth; craterGrowing=false; }
        earthMat.uniforms.craterPos.value.copy(craterPos);
        earthMat.uniforms.craterRadius.value = craterRadius;
        earthMat.uniforms.craterDepth.value = craterDepth;
      }

      earthMat.uniforms.displacementScale.value = parseFloat(topoSlider.value);

      renderer.render(scene, camera);
    }

    animate();

  });
});

// --- Resize ---
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
