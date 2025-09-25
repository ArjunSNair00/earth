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

    // Add atmosphere
    // Atmosphere parameters
    const atmosphereParams = {
      scale: 1.015,
      intensity: 2.0,
      baseColor: new THREE.Color(0.3, 0.6, 1.0),
      power: 2.0,
      baseBrightness: 0.2
    };

    const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * atmosphereParams.scale, 256, 256);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 cameraPos;
        uniform float intensity;
        uniform vec3 baseColor;
        uniform float power;
        uniform float baseBrightness;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewVector = normalize(cameraPosition - vWorldPosition);
          float viewAngle = dot(vNormal, viewVector);
          float glowIntensity = pow(0.75 - viewAngle, power);
          glowIntensity = glowIntensity * intensity + baseBrightness;
          gl_FragColor = vec4(baseColor, glowIntensity);
        }
      `,
      uniforms: {
        cameraPos: { value: camera.position },
        intensity: { value: atmosphereParams.intensity },
        baseColor: { value: atmosphereParams.baseColor },
        power: { value: atmosphereParams.power },
        baseBrightness: { value: atmosphereParams.baseBrightness }
      }
    });

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Slider for displacement
    // Helper function to create sliders
    function createSlider(label, min, max, value, step, onChange, topPosition) {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '10px';
      container.style.top = topPosition + 'px';
      container.style.color = 'white';
      container.style.fontFamily = 'Arial';

      const labelElement = document.createElement('div');
      labelElement.textContent = label;
      container.appendChild(labelElement);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;
      slider.style.width = '200px';
      
      slider.addEventListener('input', () => onChange(parseFloat(slider.value)));
      container.appendChild(slider);
      document.body.appendChild(container);
    }

    // Create sliders for all parameters
    createSlider('Terrain Height', 0, 50, 10, 0.1, (value) => {
      material.displacementScale = value;
    }, 10);

    createSlider('Atmosphere Size', 1.01, 1.05, atmosphereParams.scale, 0.001, (value) => {
      atmosphereParams.scale = value;
      atmosphere.scale.set(value, value, value);
    }, 60);

    createSlider('Atmosphere Intensity', 0.5, 5, atmosphereParams.intensity, 0.1, (value) => {
      atmosphereParams.intensity = value;
      atmosphereMaterial.uniforms.intensity.value = value;
    }, 110);

    createSlider('Atmosphere Power', 0.5, 5, atmosphereParams.power, 0.1, (value) => {
      atmosphereParams.power = value;
      atmosphereMaterial.uniforms.power.value = value;
    }, 160);

    createSlider('Base Brightness', 0, 1, atmosphereParams.baseBrightness, 0.01, (value) => {
      atmosphereParams.baseBrightness = value;
      atmosphereMaterial.uniforms.baseBrightness.value = value;
    }, 210);

    animate();

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      // Update atmosphere shader with camera position
      atmosphereMaterial.uniforms.cameraPos.value = camera.position;
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
