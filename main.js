
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);

// Camera position
camera.position.set(0, 1, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = false;

// GUI Setup
const gui = new GUI();

// Environment setup
const environments = {
    none: null,
    room: new RoomEnvironment(),
    debug: new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
};
let currentEnv = 'none';

// GUI for Environment
const envController = { env: 'none' };
gui.add(envController, 'env', ['none', 'room', 'debug']).onChange((value) => {
    currentEnv = value;
    if (value === 'room') {
        scene.environment = environments.room;
        scene.background = environments.room;
    } else if (value === 'debug') {
        scene.environment = null;
        scene.background = environments.debug;
    }
    else {
        scene.environment = null;
        scene.background = new THREE.Color("#acacac");
    }
});

// GUI for Model Selection
const modelController = { model: 'Phoenix' };
const models = {
    'Phoenix': { path: './models/phoenix_bird.glb', scale: new THREE.Vector3(0.01, 0.01, 0.01), position: new THREE.Vector3(0, 0, 0) },
    'Box': { path: './models/box.glb', scale: new THREE.Vector3(10, 10, 10), position: new THREE.Vector3(0, -2, 0) }
};
gui.add(modelController, 'model', ['Phoenix', 'Box']).onChange((value) => {
    loadModel(value);
});

// Animation mixer and action
let mixer;
let animationAction;
let targetMesh;
let isAnimationPlaying = false;
let currentModel = null;
let playButton = null;

// Function to load model
function loadModel(modelName) {
    // Remove previous model
    if (currentModel) {
        scene.remove(currentModel);
        if (mixer) {
            mixer.stopAllAction();
            mixer = null;
            animationAction = null;
        }
        if (playButton) {
            playButton.remove();
            playButton = null;
        }
        targetMesh = null;
        isAnimationPlaying = false;
    }

    const loader = new GLTFLoader();
    const modelData = models[modelName];
    loader.load(
        modelData.path,
        (gltf) => {
            console.log('Model loaded successfully:', gltf);
            const model = gltf.scene;
            scene.add(model);
            model.scale.copy(modelData.scale);
            model.position.copy(modelData.position);
            console.log('Model added to scene with scale:', model.scale, 'position:', model.position);
            currentModel = model;

            // Apply environment to materials
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material.envMapIntensity = 1.0;
                    if (child.name === 'Plane_Plane_002_Material_001_TOP_0') {
                        targetMesh = child;
                        console.log('Target mesh found:', child.name);
                    }
                }
            });
            if (!targetMesh) {
                console.warn('Target mesh Plane_Plane_002_Material_001_TOP_0 not found in model');
            }

            // Check for animations and setup
            if (gltf.animations && gltf.animations.length) {
                console.log('Animations found:', gltf.animations.map(clip => clip.name));
                let clip = THREE.AnimationClip.findByName(gltf.animations, 'CINEMA_4D_Main');
                if (!clip) {
                    console.warn('CINEMA_4D_Main not found, falling back to first animation');
                    clip = gltf.animations[0];
                }
                console.log('Selected animation:', clip.name, 'Duration:', clip.duration);
                mixer = new THREE.AnimationMixer(model);
                animationAction = mixer.clipAction(clip);
                animationAction.play();
                animationAction.paused = true; // Pause to control manually
                console.log('Animation action initialized and paused');

                // Create play/pause button
                playButton = document.createElement('button');
                playButton.id = 'playButton';
                playButton.textContent = 'Play Animation';
                document.body.appendChild(playButton);
                playButton.addEventListener('click', () => {
                    if (animationAction) {
                        isAnimationPlaying = !isAnimationPlaying;
                        animationAction.paused = !isAnimationPlaying;
                        playButton.textContent = isAnimationPlaying ? 'Pause Animation' : 'Play Animation';
                        console.log('Animation toggled:', isAnimationPlaying ? 'Playing' : 'Paused');
                    }
                });
            } else {
                console.warn('No animations found in the model');
            }
        },
        (xhr) => {
            console.log('Model loading progress: ' + (xhr.loaded / xhr.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading model:', error);
        }
    );
}

// Initial model load
loadModel('Phoenix');

// Scroll-based animation control
let maxScroll = document.body.scrollHeight - window.innerHeight;
console.log('Initial maxScroll:', maxScroll);
window.addEventListener('scroll', () => {
    console.log('Scroll event triggered');
    if (mixer && animationAction && !isAnimationPlaying) {
        const scrollPosition = window.scrollY;
        const scrollFraction = Math.min(Math.max(scrollPosition / maxScroll, 0), 1);
        const animationDuration = animationAction.getClip().duration;
        const animationTime = scrollFraction * animationDuration;
        console.log('Scroll - Position:', scrollPosition, 'Fraction:', scrollFraction, 'Animation time:', animationTime);
        mixer.setTime(animationTime); // Update animation to scroll position
    } else if (!mixer || !animationAction) {
        console.warn('Scroll event: mixer or animationAction not ready', { mixer: !!mixer, animationAction: !!animationAction });
    }

    // Rotate target mesh on X-axis
    if (targetMesh) {
        const scrollPosition = window.scrollY;
        const scrollFraction = Math.min(Math.max(scrollPosition / maxScroll, 0), 1);
        const rotationAngle = scrollFraction * maxRotation;
        targetMesh.rotation.x = -rotationAngle;
        console.log('Mesh rotation - Name:', targetMesh.name, 'X-axis rotation:', rotationAngle);
    } else {
        console.warn('Scroll event: target mesh not ready');
    }
});

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta()); // Update even if paused for setTime
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    maxScroll = document.body.scrollHeight - window.innerHeight;
    console.log('Window resized, new maxScroll:', maxScroll);
});
