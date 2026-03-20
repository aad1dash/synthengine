uniform vec3 uColor;
uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

// -----------------------------------------------------------------------
// Utility: pseudo-random hash for sparkle noise
// -----------------------------------------------------------------------
float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

// -----------------------------------------------------------------------
// Simplex-ish 3D noise (value noise, cheaper than true simplex)
// -----------------------------------------------------------------------
float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

void main() {
  // View direction (camera → fragment)
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 normal = normalize(vNormal);

  // ----- Fresnel (Schlick approximation) -----
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);

  // ----- Chromatic refraction (RGB split at different IOR offsets) -----
  // Simulate by sampling the base color at slightly shifted UV/world coords.
  float iorOffsetR = 1.00;
  float iorOffsetG = 1.02;
  float iorOffsetB = 1.04;

  vec3 refractR = refract(-viewDir, normal, 1.0 / iorOffsetR);
  vec3 refractG = refract(-viewDir, normal, 1.0 / iorOffsetG);
  vec3 refractB = refract(-viewDir, normal, 1.0 / iorOffsetB);

  // Use refracted direction to look up a procedural environment color
  float envR = noise3D(vWorldPosition + refractR * 2.0 + uTime * 0.1) * 0.5 + 0.5;
  float envG = noise3D(vWorldPosition + refractG * 2.0 + uTime * 0.1) * 0.5 + 0.5;
  float envB = noise3D(vWorldPosition + refractB * 2.0 + uTime * 0.1) * 0.5 + 0.5;
  vec3 chromaticColor = vec3(envR, envG, envB);

  // Blend chromatic refraction with the base color
  vec3 baseColor = mix(uColor, chromaticColor * uColor * 1.5, 0.4);

  // ----- Sparkle effect -----
  // High-frequency noise sampled at the world position, animated slowly
  float sparkleNoise = noise3D(vWorldPosition * 40.0 + uTime * 0.3);
  float sparkle = smoothstep(0.92, 0.98, sparkleNoise);

  // ----- Compose final color -----
  vec3 fresnelGlow = mix(uColor * 0.3, vec3(1.0), 0.6) * fresnel;
  vec3 color = baseColor + fresnelGlow + vec3(sparkle) * 0.8;

  // Slight alpha from fresnel so edges feel translucent
  float alpha = mix(0.75, 1.0, fresnel);

  gl_FragColor = vec4(color, alpha);
}
