/*-----------------------------------------------------------------------------

- Lighting a 3D cone with ArcBall control
- Supports: Arcball camera/model rotation, flat/smooth normals, Gouraud/Phong shading
-------------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText } from './util.js';
import { Shader, readShaderFile } from './shader.js';
import { Arcball } from './arcball.js';
import { Cube } from './cube.js';
import { Cone } from './cone.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let shader;
let lampShader;
let textOverlay2;
let textOverlay3;
let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create();
let lampModelMatrix = mat4.create();
let arcBallMode = 'MODEL';     // 'CAMERA' or 'MODEL'
let shadingMode = 'FLAT';      // 'FLAT' or 'SMOOTH'
let renderingMode = 'PHONG';   // 'PHONG' or 'GOURAUD'

const cone = new Cone(gl, 32, 0.5, 1.0);
const lamp = new Cube(gl);

const cameraPos = vec3.fromValues(0, 0, 3);
const lightPos = vec3.fromValues(1.0, 0.7, 1.0);
const lightSize = vec3.fromValues(0.1, 0.1, 0.1);
const arcball = new Arcball(canvas, 5.0, { rotation: 2.0, zoom: 0.0005 });

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('program terminated');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('program terminated with error:', error);
    });
});

function setupKeyboardEvents() {
    document.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'a':
                arcBallMode = arcBallMode === 'CAMERA' ? 'MODEL' : 'CAMERA';
                updateText(textOverlay2, `arcball mode: ${arcBallMode}`);
                break;
            case 'r':
                arcball.reset();
                modelMatrix = mat4.create();
                arcBallMode = 'CAMERA';
                updateText(textOverlay2, `arcball mode: ${arcBallMode}`);
                break;
            case 's':
                shadingMode = 'SMOOTH';
                cone.useSmoothShading();
                updateText(textOverlay3, `shading mode: ${shadingMode} (${renderingMode})`);
                render();
                break;
            case 'f':
                shadingMode = 'FLAT';
                cone.useFlatShading();
                updateText(textOverlay3, `shading mode: ${shadingMode} (${renderingMode})`);
                render();
                break;
            case 'g':
                renderingMode = 'GOURAUD';
                // shadingMode에 따라 맞는 normal 설정
                if (shadingMode === 'SMOOTH') {
                    cone.useSmoothShading();
                } else {
                    cone.useFlatShading();
                }
                updateText(textOverlay3, `shading mode: ${shadingMode} (${renderingMode})`);
                render();
                break;
            case 'p':
                renderingMode = 'PHONG';
                if (shadingMode === 'SMOOTH') {
                    cone.useSmoothShading();
                } else {
                    cone.useFlatShading();
                }
                updateText(textOverlay3, `shading mode: ${shadingMode} (${renderingMode})`);
                render();
                break;
        }
    });
}

function initWebGL() {
    if (!gl) return false;
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    return true;
}

async function initShader() {
    const vSrc = await readShaderFile('shVert.glsl');
    const fSrc = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vSrc, fSrc);
}

async function initLampShader() {
    const vSrc = await readShaderFile('shLampVert.glsl');
    const fSrc = await readShaderFile('shLampFrag.glsl');
    lampShader = new Shader(gl, vSrc, fSrc);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    if (arcBallMode === 'CAMERA') {
        viewMatrix = arcball.getViewMatrix();
    } else {
        modelMatrix = arcball.getModelRotMatrix();
        viewMatrix = arcball.getViewCamDistanceMatrix();
    }

    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setVec3('u_viewPos', cameraPos);
    shader.setInt('u_useGouraud', renderingMode === 'GOURAUD' ? 1 : 0);
    shader.setInt('u_useFlatNormal', shadingMode === 'FLAT' ? 1 : 0);
    cone.draw(shader);

    lampShader.use();
    lampShader.setMat4('u_view', viewMatrix);
    mat4.identity(lampModelMatrix);
    mat4.translate(lampModelMatrix, lampModelMatrix, lightPos);
    mat4.scale(lampModelMatrix, lampModelMatrix, lightSize);
    lampShader.setMat4('u_model', lampModelMatrix);
    lamp.draw(lampShader);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }

        mat4.lookAt(viewMatrix, cameraPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        mat4.perspective(projMatrix, glMatrix.toRadian(60), canvas.width / canvas.height, 0.1, 100);

        await initShader();
        await initLampShader();

        shader.use();
        shader.setMat4("u_projection", projMatrix);

        shader.setVec3("material.diffuse", vec3.fromValues(1.0, 0.5, 0.31));
        shader.setVec3("material.specular", vec3.fromValues(0.5, 0.5, 0.5));
        shader.setFloat("material.shininess", 16);

        shader.setVec3("light.position", lightPos);
        shader.setVec3("light.ambient", vec3.fromValues(0.2, 0.2, 0.2));
        shader.setVec3("light.diffuse", vec3.fromValues(0.7, 0.7, 0.7));
        shader.setVec3("light.specular", vec3.fromValues(1.0, 1.0, 1.0));
        shader.setVec3("u_viewPos", cameraPos);

        lampShader.use();
        lampShader.setMat4("u_projection", projMatrix);
        mat4.identity(lampModelMatrix);
        mat4.translate(lampModelMatrix, lampModelMatrix, lightPos);
        mat4.scale(lampModelMatrix, lampModelMatrix, lightSize);
        lampShader.setMat4('u_model', lampModelMatrix);

        setupText(canvas, 'Cone with Lighting', 1);
        textOverlay2 = setupText(canvas, `arcball mode: ${arcBallMode}`, 2);
        textOverlay3 = setupText(canvas, `shading mode: ${shadingMode} (${renderingMode})`, 3);
        setupText(canvas, `press 'a' to change arcball mode`, 4);
        setupText(canvas, `press 'r' to reset arcball`, 5);
        setupText(canvas, `press 's' to switch to smooth shading`, 6);
        setupText(canvas, `press 'f' to switch to flat shading`, 7);
        setupText(canvas, `press 'g' to switch to Gouraud shading`, 8);
        setupText(canvas, `press 'p' to switch to Phong shading`, 9);

        setupKeyboardEvents();
        requestAnimationFrame(render);
        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}
