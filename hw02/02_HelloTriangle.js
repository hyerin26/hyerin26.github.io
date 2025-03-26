// Get the canvas and WebGL 2 context
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

const textcanvas = document.getElementById('2Dtext');
const ctx = textcanvas.getContext('2d');

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

if (!ctx) {
    console.error('WebGL 2 is not supported by your browser.');
}

// Set canvas size (fixed size)
canvas.width = textcanvas.width = 600;
canvas.height = textcanvas.height = 600;

// Resize viewport while keeping the aspect ratio
import { resizeAspectRatio } from './util.js';
window.addEventListener('resize', () => {
    resizeAspectRatio(canvas, gl);
    render();
});

// Initialize WebGL settings
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.0, 0.0, 0.0, 1.0);

//shader 소스 불러오기
async function loadShaderSource(url) {
    const response = await fetch(url);
    return await response.text();
}

// Function to compile shader
function compileShader(gl, source, type) {

    // Create shader object
    const shader = gl.createShader(type);

    // Set shader source code
    gl.shaderSource(shader, source);

    // Compile shader
    gl.compileShader(shader);

    // Check if the shader compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Function to create shader program
function createProgram(gl, vertexShaderSource, fragmentShaderSource) {

    // Compile vertex and fragment shaders
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

    // Create shader program (template)
    const shaderProgram = gl.createProgram();

    // Attach shaders to the program
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);

    // Link the shaders and program to complete the shader program
    gl.linkProgram(shaderProgram);

    // Check if the program linked successfully
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(shaderProgram));
        gl.deleteProgram(shaderProgram);
        return null;
    }
    return shaderProgram;
}

async function initShaderProgram(gl) {
    const vertexSrc = await loadShaderSource("vertexShader.glsl");
    const fragmentSrc = await loadShaderSource("fragmentShader.glsl");

    return createProgram(gl, vertexSrc, fragmentSrc);
}

// Create shader program
const shaderProgram = await initShaderProgram(gl);
gl.useProgram(shaderProgram);

// Rectangle vertex coordinates (TRIANGLE_FAN for square)
const vertices = new Float32Array([
    -0.1, -0.1, 0.0,  // Bottom left
     0.1, -0.1, 0.0,  // Bottom right
     0.1,  0.1, 0.0,  // Top right
    -0.1,  0.1, 0.0   // Top left
]);

// Create Vertex Array Object (VAO)
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// Create Vertex Buffer and bind data
const vertexBuffer = gl.createBuffer();

// Designate the target vertex buffer (to bind)
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

// Feed the vertex coordinates to the vertex buffer
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Link vertex data to shader program variables
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);

// Use shader program 
gl.useProgram(shaderProgram);

// Get uniform location for translation
const u_translation = gl.getUniformLocation(shaderProgram, "u_translation");



// Initial position
let position = [0.0, 0.0]; // x, y 좌표
const moveStep = 0.01; // 이동 단위
const boundary = 0.91; // 이동 제한 범위

// Function to render the scene
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update uniform variable in shader
    gl.uniform2fv(u_translation, position);

    // Bind VAO and draw the rectangle
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Use arrow keys to move the rectangle', 20, 40);

    // Request next frame (for smooth animation, optional)
    requestAnimationFrame(render);
}

// Handle keyboard input for movement
window.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp':
            if (position[1] + moveStep <= boundary) position[1] += moveStep;
            break;
        case 'ArrowDown':
            if (position[1] - moveStep >= -boundary) position[1] -= moveStep;
            break;
        case 'ArrowLeft':
            if (position[0] - moveStep >= -boundary) position[0] -= moveStep;
            break;
        case 'ArrowRight':
            if (position[0] + moveStep <= boundary) position[0] += moveStep;
            break;
    }
    render(); // Update rendering with new position
});

// Start rendering loop
render();
