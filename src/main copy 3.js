import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import colorMap from './earth_color_10K.png';
import specularMap from './specular_map_8k.png';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100000
);
camera.position.set(0, 0, 3000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1000.1;
controls.maxDistance = 50000;
controls.zoomSpeed = 2;
controls.enablePan = false;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5000, 5000, 5000);
scene.add(directionalLight);

// Raycaster for waypoint selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Waypoints array
const waypoints = [];

// Container for HTML waypoint info
const waypointContainer = document.createElement('div');
waypointContainer.style.position = 'absolute';
waypointContainer.style.top = '0';
waypointContainer.style.left = '0';
waypointContainer.style.pointerEvents = 'none';
document.body.appendChild(waypointContainer);

// Load textures
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

    slider.addEventListener('input', () => {
      material.displacementScale = parseFloat(slider.value);
    });

    // Convert 3D position to latitude/longitude
    function posToLatLon(pos) {
      const radius = pos.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(pos.y / radius));
      const lon = -THREE.MathUtils.radToDeg(Math.atan2(pos.z, pos.x));
      return { lat, lon };
    }

    // Convert 3D position to screen coordinates
    function toScreenPosition(pos) {
      const vector = pos.clone().project(camera);
      return {
        x: (vector.x + 1) / 2 * window.innerWidth,
        y: (-vector.y + 1) / 2 * window.innerHeight
      };
    }

    // Click handler to place waypoint
    function onMouseClick(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(earth);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const { lat, lon } = posToLatLon(point);

        // Create HTML marker
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.background = 'rgba(255,255,255,0.8)';
        el.style.padding = '2px 5px';
        el.style.borderRadius = '4px';
        el.style.fontFamily = 'sans-serif';
        el.style.fontSize = '12px';
        el.style.color = '#000';
        el.style.pointerEvents = 'auto';
        el.innerHTML = `📍 Lat: ${lat.toFixed(2)}°, Lon: ${lon.toFixed(2)}°`;
        waypointContainer.appendChild(el);

        waypoints.push({ el, position: point });
      }
    }

    window.addEventListener('click', onMouseClick);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      // Update waypoint positions
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

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
