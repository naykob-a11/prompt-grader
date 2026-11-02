#version 300 es
// Pass 1: per-pixel grade. Spec: docs/04 section 2. CPU twin: cpu/grade.ts.
// Any change here must land together with the CPU code. Section numbers match the spec.
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D u_src;   // output of the detail pass
uniform sampler2D u_orig;  // pixels from before it, used by the final mix
uniform vec3 u_wbGains;
uniform ivec2 u_fullSize;  // the whole image, also when drawing one tile
uniform ivec2 u_origin;    // this tile's corner in the whole image
uniform ivec2 u_pad;       // this tile's corner in its texture
uniform int u_flipHeight;  // view height when drawing to a canvas, 0 when drawing to a texture
// @param-uniforms

out vec4 outColor;

const float BAND_CENTERS[6] = float[6](0.0, 50.0, 115.0, 180.0, 225.0, 285.0);

float sm(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// The same integer hash as math.ts, so grain matches the CPU pixel for pixel.
float hash2(int x, int y) {
  uint h = (uint(x) * 374761393u) ^ (uint(y) * 668265263u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}

vec3 hueOffset(float deg) {
  float h = mod(deg, 360.0) / 60.0;
  float x = 1.0 - abs(mod(h, 2.0) - 1.0);
  vec3 c;
  if (h < 1.0) c = vec3(1.0, x, 0.0);
  else if (h < 2.0) c = vec3(x, 1.0, 0.0);
  else if (h < 3.0) c = vec3(0.0, 1.0, x);
  else if (h < 4.0) c = vec3(0.0, x, 1.0);
  else if (h < 5.0) c = vec3(x, 0.0, 1.0);
  else c = vec3(1.0, 0.0, x);
  return c - (c.r + c.g + c.b) / 3.0;
}

void main() {
  ivec2 view = ivec2(gl_FragCoord.xy);
  if (u_flipHeight > 0) view.y = u_flipHeight - 1 - view.y;
  ivec2 texel = view + u_pad;
  ivec2 pos = view + u_origin;
  float px = float(pos.x);
  float py = float(pos.y);

  vec3 c0 = texelFetch(u_orig, texel, 0).rgb;
  float alpha = texelFetch(u_orig, texel, 0).a;
  vec3 c = texelFetch(u_src, texel, 0).rgb;

  float W = float(u_fullSize.x);
  float H = float(u_fullSize.y);

  // 2.1 exposure, white balance, cast fix
  float temp = u_temp / 100.0;
  float tint = u_tint / 100.0;
  float cf = u_castFix / 100.0;
  vec3 wb = vec3(
    (1.0 + temp * 0.12 + tint * 0.03) * (1.0 + (u_wbGains.r - 1.0) * cf),
    (1.0 - tint * 0.08) * (1.0 + (u_wbGains.g - 1.0) * cf),
    (1.0 - temp * 0.12 + tint * 0.03) * (1.0 + (u_wbGains.b - 1.0) * cf)
  );
  c = min(vec3(1.0), c * pow(2.0, u_exposure / 100.0) * wb);

  // 2.2 dehaze
  float dz = u_dehaze / 100.0 * 0.18;
  if (dz > 0.0) c = clamp((c - dz * 0.8) / (1.0 - dz), 0.0, 1.0);

  // 2.3 HSV stage
  float L0 = luma(c);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float h = 0.0;
  float s = mx > 0.0 ? d / mx : 0.0;
  float v = mx;
  if (d > 1e-5) {
    if (mx == c.r) h = (c.g - c.b) / d;
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h *= 60.0;
    if (h < 0.0) h += 360.0;
  }

  float bandHue[6] = float[6](u_hR, u_hY, u_hG, u_hA, u_hB, u_hP);
  float bandSat[6] = float[6](u_sR, u_sY, u_sG, u_sA, u_sB, u_sP);
  float bandLum[6] = float[6](u_lR, u_lY, u_lG, u_lA, u_lB, u_lP);
  float cw = min(1.0, s * 4.0);
  float dh = 0.0;
  float ds = 0.0;
  float dl = 0.0;
  for (int k = 0; k < 6; k++) {
    float ad = abs(h - BAND_CENTERS[k]);
    if (ad > 180.0) ad = 360.0 - ad;
    float wt = ad < 45.0 ? (1.0 - ad / 45.0) * cw : 0.0;
    dh += wt * bandHue[k] / 100.0 * 30.0;
    ds += wt * bandSat[k] / 100.0;
    dl += wt * bandLum[k] / 100.0;
  }

  float teal = u_teal / 100.0;
  float forest = u_forest / 100.0;
  float sun = u_sun / 100.0;
  float fw = 0.0;
  if (h > 45.0 && h < 190.0) {
    fw = h < 80.0 ? sm(45.0, 80.0, h) : h > 150.0 ? 1.0 - sm(150.0, 190.0, h) : 1.0;
  }
  fw *= min(1.0, s * 3.2);
  float lit = sm(0.42, 0.82, L0);
  if (fw > 0.0) {
    float warm = h > 80.0 ? min(28.0, (h - 72.0) * 0.55) : 0.0;
    dh += fw * ((1.0 - lit) * teal * 34.0 - lit * sun * warm);
  }

  h = mod(h + dh, 360.0);
  s *= (1.0 + ds) * (1.0 - fw * 0.1 * teal * (1.0 - lit)) * (1.0 + fw * 0.06 * sun * lit);
  float vib = u_vibrance / 100.0;
  s = vib >= 0.0 ? s + vib * s * (1.0 - s) * 1.5 : s * (1.0 + vib * (1.0 - s * 0.5));
  s = clamp(s, 0.0, 1.0);
  v *= (1.0 + dl * 0.35) * (1.0 - fw * forest * 0.22 * (1.0 - L0) * (1.0 - lit * 0.6));
  v = clamp(v, 0.0, 1.0);

  float chroma = v * s;
  float hp = h / 60.0;
  float xx = chroma * (1.0 - abs(mod(hp, 2.0) - 1.0));
  if (hp < 1.0) c = vec3(chroma, xx, 0.0);
  else if (hp < 2.0) c = vec3(xx, chroma, 0.0);
  else if (hp < 3.0) c = vec3(0.0, chroma, xx);
  else if (hp < 4.0) c = vec3(0.0, xx, chroma);
  else if (hp < 5.0) c = vec3(xx, 0.0, chroma);
  else c = vec3(chroma, 0.0, xx);
  c += v - chroma;

  // 2.4 global saturation
  float sat = u_saturation / 100.0;
  if (sat != 0.0) {
    float Ls = luma(c);
    c = Ls + (c - Ls) * (1.0 + sat);
  }

  // 2.5 tone on luminance
  float L = luma(c);
  float Ln = L;
  Ln += u_highlights / 100.0 * 0.2 * sm(0.5, 1.0, L);
  Ln += u_shadows / 100.0 * 0.25 * (1.0 - L) * (1.0 - L) * (1.0 - sm(0.4, 0.75, L));
  float t = Ln - 0.5;
  Ln = 0.5 + t * (1.0 + u_contrast / 100.0 * 0.7 * (1.0 - 4.0 * t * t));
  Ln = clamp(Ln, 0.0, 1.05);
  if (L > 1e-4) c *= Ln / L;
  else c = vec3(Ln);

  // 2.6 split toning
  float sw = (1.0 - Ln) * (1.0 - Ln) * (1.0 - sm(0.5, 0.8, Ln)) * (u_shSat / 100.0 * 0.16);
  float hw = sm(0.55, 0.98, Ln) * (u_hiSat / 100.0 * 0.13);
  c += hueOffset(u_shHue) * sw + hueOffset(u_hiHue) * hw;

  // 2.7 yellow guard
  float guard = u_guard / 100.0;
  if (guard > 0.0) {
    float yel = min(c.r, c.g) - c.b - 0.1;
    if (yel > 0.0) {
      float f = yel * guard * 0.55 * sm(0.25, 0.7, Ln);
      c += vec3(-0.9, -0.55, 0.25) * f;
    }
  }

  // 2.8 haze
  float reach = 0.15 + u_reach / 100.0 * 0.75;
  float hz = 1.0 - py / H / reach;
  hz = hz > 0.0 ? pow(hz, 1.5) * (u_haze / 100.0) * 0.6 : 0.0;
  if (hz > 0.0) {
    float hzT = u_hazeTemp / 100.0;
    float tg = 0.55 + luma(c) * 0.35;
    c += (vec3(tg + hzT * 0.04, tg, tg - hzT * 0.05) - c) * hz;
  }

  // 2.9 fade, vignette, grain
  float fl = u_fade / 100.0 * 0.07;
  if (fl > 0.0) c = fl + c * (1.0 - fl * 1.1);
  float vig = u_vignette / 100.0;
  if (vig > 0.0) {
    float cx = W / 2.0;
    float cy = H / 2.0;
    float dist = length(vec2(px - cx, py - cy)) / length(vec2(cx, cy));
    c *= 1.0 - vig * 0.5 * sm(0.38, 1.05, dist);
  }
  float grain = u_grain / 100.0;
  if (grain > 0.0) {
    float fall = 1.0 - min(1.0, abs(luma(c) - 0.45) * 1.4);
    c += (hash2(pos.x, pos.y) + hash2(pos.x + 1, pos.y + 7) - 1.0) * grain * 0.075 * fall;
  }

  // 2.10 mix with the pixel from before the detail pass
  outColor = vec4(clamp(c0 + (c - c0) * (u_amount / 100.0), 0.0, 1.0), alpha);
}
