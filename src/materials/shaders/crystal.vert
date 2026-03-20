uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Subtle time-based vertex displacement along the normal for a living shimmer.
  // The displacement combines two sine waves at different frequencies so it
  // never looks perfectly periodic.
  float displacement = sin(position.x * 4.0 + uTime * 1.2)
                     * cos(position.y * 3.0 + uTime * 0.9)
                     * sin(position.z * 5.0 + uTime * 0.7)
                     * 0.015;

  vec3 displaced = position + normal * displacement;

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
