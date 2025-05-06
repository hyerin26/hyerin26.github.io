#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec2 a_texCoord;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

uniform vec3 u_viewPos;
uniform highp int u_useGouraud;     // 1 = Gouraud, 0 = Phong
uniform highp int u_useFlatNormal;  // 1 = flat, 0 = smooth

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

out vec3 fragPos;               // for Phong
out vec3 v_normal;              // for Phong (smooth)
flat out vec3 v_normal_flat;    // for Phong (flat)
out vec3 lightingColor;         // for Gouraud

void main() {
    vec4 worldPos = u_model * vec4(a_position, 1.0);
    fragPos = vec3(worldPos);
    
    // always compute transformed normal
    vec3 transformedNormal = normalize(mat3(transpose(inverse(u_model))) * a_normal);
    v_normal = transformedNormal;
    v_normal_flat = transformedNormal;

    gl_Position = u_projection * u_view * worldPos;

    if (u_useGouraud == 1) {
        vec3 norm = (u_useFlatNormal == 1) ? v_normal_flat : v_normal;
        vec3 rgb = material.diffuse;

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

        lightingColor = ambient + diffuse + specular;
    } else {
        lightingColor = vec3(0);  // not used in Phong
    }
}
