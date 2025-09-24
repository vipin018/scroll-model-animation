import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DebugEnvironment } from 'three/examples/jsm/environments/DebugEnvironment.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

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

// Stats
const stats = new Stats();
document.body.appendChild(stats.dom);

// GUI Setup
const gui = new GUI();

// Environment setup
const environments = {
    none: null,
    room: new RoomEnvironment(),
    debug: new DebugEnvironment(renderer),
};
let currentEnv = 'none';

// GUI for Environment
const envController = { env: 'none' };
gui.add(envController, 'env', ['none', 'room', 'debug']).onChange((value) => {
    currentEnv = value;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    if (value === 'room') {
        const roomEnv = environments.room;
        const envMap = pmremGenerator.fromScene(roomEnv).texture;
        scene.environment = envMap;
        scene.background = envMap;
        pmremGenerator.dispose();
    } else if (value === 'debug') {
        scene.add(environments.debug);
        scene.background = new THREE.Color("#acacac");
    } else {
        scene.environment = null;
        scene.background = new THREE.Color("#acacac");
        scene.remove(environments.debug);
    }
});

// GUI for Model Selection
const modelController = { model: 'Phoenix' };
const models = {
    'Phoenix': { path: './models/phoenix_bird.glb', scale: new THREE.Vector3(0.005, 0.005, 0.005), position: new THREE.Vector3(0, 0, 0) },
    'Box': { path: './models/box.glb', scale: new THREE.Vector3(7, 7, 7), position: new THREE.Vector3(0, 0, 0) }
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

// Helpers
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
let boxHelper = null;

const helperController = {
    axes: true,
    grid: true,
    box: true
};

const helpersFolder = gui.addFolder('Helpers');
helpersFolder.add(helperController, 'axes').name('Axes Helper').onChange((value) => {
    axesHelper.visible = value;
});
helpersFolder.add(helperController, 'grid').name('Grid Helper').onChange((value) => {
    gridHelper.visible = value;
});
helpersFolder.add(helperController, 'box').name('Box Helper').onChange((value) => {
    if (boxHelper) boxHelper.visible = value;
});

// GUI for model transformations
const transformFolder = gui.addFolder('Transform');
const scaleFolder = transformFolder.addFolder('Scale');
const positionFolder = transformFolder.addFolder('Position');
const rotationFolder = transformFolder.addFolder('Rotation');
const animationFolder = gui.addFolder('Animation');

let scaleControl, positionControls, rotationControls, animationController;

function setupTransformControls() {
    if (scaleControl) {
        scaleControl.destroy();
    }
    if (positionControls) {
        positionControls.x.destroy();
        positionControls.y.destroy();
        positionControls.z.destroy();
    }
    if (rotationControls) {
        rotationControls.x.destroy();
        rotationControls.y.destroy();
        rotationControls.z.destroy();
    }

    if (currentModel) {
        const scaleValue = { scale: currentModel.scale.x };
        scaleControl = scaleFolder.add(scaleValue, 'scale', 0.01, 10).name('Uniform Scale').onChange((value) => {
            if (currentModel) {
                currentModel.scale.set(value, value, value);
            }
        });

        positionControls = {
            x: positionFolder.add(currentModel.position, 'x', -10, 10).name('X'),
            y: positionFolder.add(currentModel.position, 'y', -10, 10).name('Y'),
            z: positionFolder.add(currentModel.position, 'z', -10, 10).name('Z')
        };
        rotationControls = {
            x: rotationFolder.add(currentModel.rotation, 'x', 0, Math.PI * 2).name('X'),
            y: rotationFolder.add(currentModel.rotation, 'y', 0, Math.PI * 2).name('Y'),
            z: rotationFolder.add(currentModel.rotation, 'z', 0, Math.PI * 2).name('Z')
        };
    }
}

function setupAnimationControls() {
    if (animationController) {
        animationController.destroy();
    }
    const animationSettings = { play: false };
    animationController = animationFolder.add(animationSettings, 'play').name('Play Animation').onChange((value) => {
        if (animationAction) {
            isAnimationPlaying = value;
            animationAction.paused = !value;
        }
    });
}

// Function to load model
function loadModel(modelName) {
    // Remove previous model
    if (currentModel) {
        scene.remove(currentModel);
        if (boxHelper) scene.remove(boxHelper);
        if (mixer) {
            mixer.stopAllAction();
            mixer = null;
            animationAction = null;
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

            boxHelper = new THREE.BoxHelper(currentModel, 0xffff00);
            scene.add(boxHelper);
            boxHelper.visible = helperController.box;

            setupTransformControls();
            setupAnimationControls();


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
    if (mixer && animationAction) {
        const scrollPosition = window.scrollY;
        const scrollFraction = Math.min(Math.max(scrollPosition / maxScroll, 0), 1);
        const animationDuration = animationAction.getClip().duration;
        const animationTime = scrollFraction * animationDuration;
        mixer.setTime(animationTime);
    }

    // Rotate target mesh on X-axis
    if (targetMesh) {
        const scrollPosition = window.scrollY;
        const scrollFraction = Math.min(Math.max(scrollPosition / maxScroll, 0), 1);
        const maxRotation = Math.PI / 2;
        const rotationAngle = scrollFraction * maxRotation;
        targetMesh.rotation.x = -rotationAngle;
    }
});

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    stats.begin();
    if (boxHelper) boxHelper.update();
    controls.update();
    renderer.render(scene, camera);
    stats.end();
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