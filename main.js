import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
document.body.style.height = "500vh";


// Camera position
camera.position.set(0, 1, 5);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false; // Disable zooming

// Stats
const stats = new Stats();
document.body.appendChild(stats.dom);

// GUI setup
const gui = new GUI();

// Environment setup
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(roomEnv).texture;
scene.background = new THREE.Color("#acacac");

// Model definitions
const models = {
    'Phoenix': { path: './models/phoenix_bird.glb', scale: 0.005, position: new THREE.Vector3(0, 0, 0) },
    'Box': { path: './models/box.glb', scale: 7, position: new THREE.Vector3(0, 0, 0) },
    'Cube': { path: './models/cube.glb', scale: 1, position: new THREE.Vector3(0, 0, 0) },
    'Skeleton': { path: './models/skeleton.glb', scale: 0.5, position: new THREE.Vector3(0, -1, 0) },
    'Lion': { path: './models/lion.glb', scale: 0.5, position: new THREE.Vector3(0, -1, 0) }
};

// GUI for model selection
const modelController = { model: 'Phoenix' };
gui.add(modelController, 'model', Object.keys(models)).name('Model').onChange(loadModel);

// Animation mixer
let mixer, animationAction, currentModel, targetMesh;
let isAnimationPlaying = false;

// Helpers
const axesHelper = new THREE.AxesHelper(5);
const gridHelper = new THREE.GridHelper(10, 10);
let boxHelper;
scene.add(axesHelper, gridHelper);

// GUI for animation
const animationFolder = gui.addFolder('Animation');
const animationSettings = { play: false };
animationFolder.add(animationSettings, 'play').name('Play Animation').onChange(value => {
    isAnimationPlaying = value;
    if (animationAction) {
        animationAction.paused = !value;
        if (!value) {
            mixer.setTime(0); // Reset animation to start when disabled
            if (targetMesh) {
                targetMesh.rotation.x = 0; // Reset target mesh rotation
            }
        }
    }
});

// GUI for scale
const scaleFolder = gui.addFolder('Scale');
let scaleControl;

// Load model function
function loadModel(modelName) {
    if (currentModel) {
        scene.remove(currentModel);
        if (boxHelper) scene.remove(boxHelper);
        if (mixer) mixer.stopAllAction();
        mixer = null;
        animationAction = null;
        targetMesh = null;
        isAnimationPlaying = false;
        if (scaleControl) scaleControl.destroy();
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    const modelData = models[modelName];
    loader.load(modelData.path, gltf => {
        const model = gltf.scene;
        scene.add(model);
        model.scale.setScalar(modelData.scale);
        model.position.copy(modelData.position);
        currentModel = model;

        // Scale control
        const scaleValue = { scale: modelData.scale };
        scaleControl = scaleFolder.add(scaleValue, 'scale', 0.001, 1).name('Uniform Scale').onChange(value => {
            if (currentModel) currentModel.scale.setScalar(value);
        });

        // Apply environment to materials
        model.traverse(child => {
            if (child.isMesh && child.name === 'Plane_Plane_002_Material_001_TOP_0') {
                targetMesh = child;
            }
        });

        // Animation setup
        if (gltf.animations && gltf.animations.length) {
            const clip = gltf.animations[0];
            mixer = new THREE.AnimationMixer(model);
            animationAction = mixer.clipAction(clip);
            animationAction.play();
            animationAction.paused = true;
        }
    });
}

// Initial model load
loadModel('Phoenix');

// Scroll-based animation
let maxScroll = document.body.scrollHeight - window.innerHeight;
window.addEventListener('scroll', () => {
    if (isAnimationPlaying && mixer && animationAction) {
        const scrollFraction = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
        const animationTime = scrollFraction * animationAction.getClip().duration;
        mixer.setTime(animationTime);
    }

    if (isAnimationPlaying && targetMesh) {
        const scrollFraction = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
        const maxRotation = Math.PI / 2;
        targetMesh.rotation.x = -scrollFraction * maxRotation;
    }
});

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    maxScroll = document.body.scrollHeight - window.innerHeight; // Update maxScroll dynamically
    controls.update();
    renderer.render(scene, camera);
    stats.begin();
    stats.end();
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    maxScroll = document.body.scrollHeight - window.innerHeight;
});