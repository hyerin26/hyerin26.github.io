#version 300 es
layout(location = 0) in vec3 aPos;
uniform vec2 u_translation;

void main() {
    gl_Position = vec4(aPos.xy + u_translation, 0.0, 1.0);
}
