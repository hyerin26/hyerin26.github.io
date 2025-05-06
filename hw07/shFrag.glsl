#version 300 es
precision highp float;
precision highp int;

in vec3 fragPos;
in vec3 lightingColor;
in vec3 v_normal;              // smooth normal
flat in vec3 v_normal_flat;    // flat normal

out vec4 FragColor;

uniform vec3 u_viewPos;
uniform highp int u_useGouraud;
uniform highp int u_useFlatNormal;

struct Material {
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

struct Light {
    vec3 position;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform Material material;
uniform Light light;

void main() {
    if (u_useGouraud == 1) {
        // Gouraud shading: vertex shader already computed lighting
        FragColor = vec4(lightingColor, 1.0);
    } else {
        // Phong shading: compute lighting here
        vec3 rgb = material.diffuse;

        // normal 선택: flat 또는 smooth
        vec3 norm = (u_useFlatNormal == 1) ? normalize(v_normal_flat) : normalize(v_normal);

        // ambient
        vec3 ambient = light.ambient * rgb;

        // diffuse
        vec3 lightDir = normalize(light.position - fragPos);
        float diff = max(dot(norm, lightDir), 0.0);
        vec3 diffuse = light.diffuse * diff * rgb;

        // specular
        vec3 viewDir = normalize(u_viewPos - fragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = (diff > 0.0) ? pow(max(dot(viewDir, reflectDir), 0.0), material.shininess) : 0.0;
        vec3 specular = light.specular * spec * material.specular;

        vec3 result = ambient + diffuse + specular;
        FragColor = vec4(result, 1.0);
    }
}
