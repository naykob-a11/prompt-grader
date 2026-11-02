#version 300 es
// Pass 0: edge-aware denoise and unsharp mask. Spec: docs/04 section 1. CPU twin: cpu/detail.ts.
// Rendered to RGBA8 on purpose: the CPU path also quantizes this pass to 8 bits.
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_image;
// @param-uniforms

out vec4 outColor;

float sm(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  ivec2 size = textureSize(u_image, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 center = texelFetch(u_image, p, 0);

  vec3 blur = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      blur += texelFetch(u_image, clamp(p + ivec2(dx, dy), ivec2(0), size - 1), 0).rgb;
    }
  }
  blur /= 9.0;

  vec3 P = center.rgb;
  float dl = abs(dot(P - blur, vec3(0.2126, 0.7152, 0.0722)));
  float wn = u_denoise / 100.0 * 0.85 * (1.0 - sm(0.015, 0.07, dl));
  float ws = u_sharpen / 100.0 * 1.6 * sm(0.01, 0.045, dl);
  // Rounded here because hardware may round a value near .5 either way when writing RGBA8.
  vec3 detailed = clamp(P + (blur - P) * wn + (P - blur) * ws, 0.0, 1.0);
  outColor = vec4(floor(detailed * 255.0 + 0.5) / 255.0, center.a);
}
