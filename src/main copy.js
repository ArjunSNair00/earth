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

// Load textures
const loader = new THREE.TextureLoader();
loader.load(colorMap, function(colorTexture) {
  loader.load(specularMap, function(specTexture) {
    const EARTH_RADIUS = 1000;

    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 256, 256);

    const material = new THREE.MeshPhongMaterial({
      map: colorTexture,
      displacementMap: colorTexture,
      displacementScale: 10,
      specularMap: specTexture,
      specular: new THREE.Color(0x888888), // intensity of specular highlights
      shininess: 50,                       // how sharp the specular is
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

    animate();

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
  });
});

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
