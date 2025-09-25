import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Papa from 'papaparse';
import colorMap from './earth_color_10K.png';
import specularMap from './specular_map_8k.png';

// ---------------- Scene Setup ----------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(0, 0, 3000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1000.1;
controls.maxDistance = 50000;
controls.zoomSpeed = 2;
controls.enablePan = false;

// ---------------- Lights ----------------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5000, 5000, 5000);
scene.add(directionalLight);

// ---------------- CSV Data ----------------
let countriesData = [];
let csvLoaded = false;

fetch('./longitude-latitude.csv')
  .then(res => res.text())
  .then(text => {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    countriesData = result.data.map(row => ({
      country: row['Country']?.trim(),
      lat: parseFloat(row['Latitude']),
      lon: parseFloat(row['Longitude'])
    })).filter(row => row.country && !isNaN(row.lat) && !isNaN(row.lon));
    csvLoaded = true;
    console.log('Loaded countries:', countriesData.length);
  });

// ---------------- Raycaster ----------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ---------------- Waypoint Container ----------------
const waypoints = [];
const waypointContainer = document.createElement('div');
waypointContainer.style.position = 'absolute';
waypointContainer.style.top = '0';
waypointContainer.style.left = '0';
waypointContainer.style.pointerEvents = 'none';
document.body.appendChild(waypointContainer);

// ---------------- Load Earth ----------------
const loader = new THREE.TextureLoader();
loader.load(colorMap, (colorTexture) => {
  loader.load(specularMap, (specTexture) => {
    const EARTH_RADIUS = 1000;
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 256, 256);

    const material = new THREE.MeshPhongMaterial({
      map: colorTexture,
      displacementMap: colorTexture,
      displacementScale: 10,
      specularMap: specTexture,
      specular: new THREE.Color(0x888888),
      shininess: 50,
    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // Slider for displacement
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 50;
    slider.step = 0.1;
    slider.value = 10;
    slider.style.position = 'absolute';
    slider.style.top = '10px';
    slider.style.left = '10px';
    document.body.appendChild(slider);
    slider.addEventListener('input', () => { material.displacementScale = parseFloat(slider.value); });

    // ---------------- Helper Functions ----------------
    function posToLatLon(pos) {
      const radius = pos.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(pos.y / radius));
      const lon = -THREE.MathUtils.radToDeg(Math.atan2(pos.z, pos.x));
      return { lat, lon };
    }

    function toScreenPosition(pos) {
      const vector = pos.clone().project(camera);
      return {
        x: (vector.x + 1) / 2 * window.innerWidth,
        y: (-vector.y + 1) / 2 * window.innerHeight
      };
    }

    function findNearestCountry(lat, lon) {
      if (!countriesData.length) return 'Unknown';
      let closest = countriesData[0];
      let minDist = Math.hypot(lat - closest.lat, lon - closest.lon);
      for (let i = 1; i < countriesData.length; i++) {
        const d = Math.hypot(lat - countriesData[i].lat, lon - countriesData[i].lon);
        if (d < minDist) {
          minDist = d;
          closest = countriesData[i];
        }
      }
      return closest.country;
    }

    // ---------------- Mouse Handling ----------------
    let mouseDownTime = 0;
    renderer.domElement.addEventListener('mousedown', (event) => { if (event.button === 0) mouseDownTime = Date.now(); });
    renderer.domElement.addEventListener('mouseup', (event) => {
      if (!csvLoaded || event.button !== 0) return;
      if (Date.now() - mouseDownTime > 200) return; // drag detection

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(earth);
      if (intersects.length > 0) {
        waypoints.forEach(wp => wp.el.remove());
        waypoints.length = 0;

        const point = intersects[0].point;
        const { lat, lon } = posToLatLon(point);
        const country = findNearestCountry(lat, lon);

        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.background = 'rgba(255,255,255,0.8)';
        el.style.padding = '2px 5px';
        el.style.borderRadius = '4px';
        el.style.fontFamily = 'sans-serif';
        el.style.fontSize = '12px';
        el.style.color = '#000';
        el.style.pointerEvents = 'auto';
        el.innerHTML = `📍 Lat: ${lat.toFixed(2)}°, Lon: ${lon.toFixed(2)}°<br>${country}`;
        waypointContainer.appendChild(el);

        waypoints.push({ el, position: point });
      }
    });

    // ---------------- Animate ----------------
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      waypoints.forEach(wp => {
        const screenPos = toScreenPosition(wp.position);
        wp.el.style.left = `${screenPos.x}px`;
        wp.el.style.top = `${screenPos.y}px`;
      });
      renderer.render(scene, camera);
    }
    animate();
  });
});

// ---------------- Handle resize ----------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
