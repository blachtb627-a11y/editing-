export const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_tex;
void main() {
  v_tex = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Plain copy (used to downsample the mipmapped source into blur buffers). */
export const COPY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_tex;
out vec4 o;
uniform sampler2D u_tex;
void main() { o = vec4(texture(u_tex, v_tex).rgb, 1.0); }`;

/** Separable gaussian blur. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_tex;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_step;   // texel step * direction
uniform float u_sigma; // in texels
void main() {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i);
    float w = exp(-(x * x) / (2.0 * u_sigma * u_sigma));
    acc += texture(u_tex, v_tex + u_step * x).rgb * w;
    wsum += w;
  }
  o = vec4(acc / wsum, 1.0);
}`;

export const MAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_tex;
out vec4 o;

uniform sampler2D u_src;
uniform sampler2D u_blurL;   // wide blur: local tone, clarity, dehaze
uniform sampler2D u_blurS;   // narrow blur: texture, noise reduction
uniform sampler2D u_lut;

uniform mat3 u_M;            // crop-local (y down) -> source uv
uniform vec4 u_view;         // frame sub-rect being rendered (x,y,w,h)
uniform vec4 u_imgRect;      // image area inside the frame
uniform vec3 u_borderColor;
uniform vec2 u_outSize;      // render target size in px
uniform vec2 u_framePx;      // nominal export frame size in px (grain scale)
uniform float u_cropAspect;
uniform bool u_bypass;
uniform bool u_useLut;
uniform bool u_useHsl;

uniform float u_exposure;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_temp;
uniform float u_tint;
uniform float u_vibrance;
uniform float u_saturation;
uniform float u_clarity;
uniform float u_texture;
uniform float u_dehaze;
uniform float u_sharpen;
uniform float u_nr;
uniform vec3 u_vignette;     // amount, midpoint, feather
uniform vec2 u_grain;        // amount, size
uniform float u_fade;
uniform float u_hslHue[8];
uniform float u_hslSat[8];
uniform float u_hslLum[8];
uniform vec3 u_gradeS;
uniform vec3 u_gradeM;
uniform vec3 u_gradeH;
uniform vec3 u_gradeLum;     // shadows, mids, highlights luminance
uniform vec2 u_gradeBal;     // balance, blending

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float luma(vec3 c) { return dot(c, LUMA); }

vec3 toLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toGamma(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l = (mx + mn) * 0.5;
  float d = mx - mn;
  if (d < 1e-5) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}
float hue2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 h) {
  if (h.y < 1e-5) return vec3(h.z);
  float q = h.z < 0.5 ? h.z * (1.0 + h.y) : h.z + h.y - h.z * h.y;
  float p = 2.0 * h.z - q;
  return vec3(hue2rgb(p, q, h.x + 1.0 / 3.0), hue2rgb(p, q, h.x), hue2rgb(p, q, h.x - 1.0 / 3.0));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float sigmoidContrast(float x, float k) {
  x = clamp(x, 0.0, 1.0);
  return x < 0.5 ? 0.5 * pow(2.0 * x, k) : 1.0 - 0.5 * pow(2.0 - 2.0 * x, k);
}

// White balance + exposure + brightness: shared by the pixel and its blurred neighbourhood
vec3 baseTone(vec3 c) {
  vec3 lin = toLinear(c);
  vec3 wb = vec3(1.0 + u_temp * 0.28 + u_tint * 0.06, 1.0 - u_tint * 0.2, 1.0 - u_temp * 0.28 + u_tint * 0.06);
  wb /= dot(wb, LUMA);
  lin *= wb * exp2(u_exposure);
  vec3 g = toGamma(lin);
  return pow(max(g, 0.0), vec3(exp2(-u_brightness * 0.75)));
}

float lut1(float x, int ch) {
  float u = clamp(x, 0.0, 1.0) * (1023.0 / 1024.0) + 0.5 / 1024.0;
  return texture(u_lut, vec2(u, 0.5))[ch];
}

void main() {
  vec2 f = u_view.xy + vec2(v_tex.x, 1.0 - v_tex.y) * u_view.zw;
  vec2 p = (f - u_imgRect.xy) / u_imgRect.zw;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) {
    o = vec4(u_borderColor, 1.0);
    return;
  }
  vec2 uv = (u_M * vec3(p, 1.0)).xy;
  vec3 c = texture(u_src, uv).rgb;
  if (u_bypass) {
    o = vec4(c, 1.0);
    return;
  }

  // ---- detail (operates on the raw pixel) ----
  vec3 bs = texture(u_blurS, uv).rgb;
  if (u_nr > 0.0) {
    float d = length(c - bs);
    float w = u_nr * (1.0 - smoothstep(0.02, 0.18, d));
    c = mix(c, bs, w);
  }
  if (u_sharpen > 0.0) {
    vec2 dp = (u_view.zw / u_outSize) / u_imgRect.zw;
    vec2 dx = (u_M * vec3(dp.x, 0.0, 0.0)).xy;
    vec2 dy = (u_M * vec3(0.0, dp.y, 0.0)).xy;
    vec3 n = texture(u_src, uv + dx).rgb + texture(u_src, uv - dx).rgb + texture(u_src, uv + dy).rgb + texture(u_src, uv - dy).rgb;
    float hp = luma(c - n * 0.25);
    c += clamp(hp * u_sharpen * 2.2, -0.15, 0.15);
  }
  if (u_texture != 0.0) {
    float det = luma(c - bs);
    c += det * u_texture * (u_texture > 0.0 ? 1.6 : 1.0);
  }

  // ---- light ----
  vec3 bl = baseTone(texture(u_blurL, uv).rgb);
  c = baseTone(c);

  float bp = -u_blacks * 0.12;
  float wp = 1.0 - u_whites * 0.18;
  c = (c - bp) / (wp - bp);
  bl = (bl - bp) / (wp - bp);

  float L = luma(c);
  float bL = luma(bl);
  // edge-aware local luminance: lean on the neighbourhood, except across strong edges (avoids halos)
  float edge = smoothstep(0.04, 0.22, abs(L - bL));
  float Lm = mix(L, bL, 0.7 * (1.0 - edge));
  float shMask = 1.0 - smoothstep(0.0, 0.6, Lm);
  float hiMask = smoothstep(0.35, 1.0, Lm);
  if (u_shadows > 0.0) c += u_shadows * 0.32 * shMask * shMask * (1.0 - clamp(c, 0.0, 1.0) * 0.5);
  else c *= 1.0 + u_shadows * 0.75 * shMask;
  if (u_highlights < 0.0) c *= 1.0 + u_highlights * 0.5 * hiMask;
  else c += u_highlights * 0.3 * hiMask * (1.0 - clamp(c, 0.0, 1.0));

  c = clamp(c, 0.0, 1.0);

  if (u_contrast != 0.0) {
    float k = u_contrast > 0.0 ? 1.0 + u_contrast * 1.1 : 1.0 + u_contrast * 0.6;
    c = vec3(sigmoidContrast(c.r, k), sigmoidContrast(c.g, k), sigmoidContrast(c.b, k));
  }

  // ---- local contrast ----
  L = luma(c);
  if (u_clarity != 0.0) {
    float mid = 1.0 - pow(abs(2.0 * L - 1.0), 2.0);
    float det = L - luma(clamp(bl, 0.0, 1.0));
    // limit the detail term near hard edges so strong clarity doesn't ring
    det = sign(det) * min(abs(det), 0.18);
    c += det * u_clarity * (u_clarity > 0.0 ? 0.9 : 0.5) * mid;
  }
  if (u_dehaze > 0.0) {
    float dark = clamp(min(bl.r, min(bl.g, bl.b)), 0.0, 1.0);
    float t = u_dehaze * 0.75 * dark;
    c = (c - t) / max(1.0 - t, 0.25);
    float l2 = luma(c);
    c = mix(vec3(l2), c, 1.0 + u_dehaze * 0.25);
  } else if (u_dehaze < 0.0) {
    c = mix(c, vec3(0.78, 0.8, 0.82), -u_dehaze * 0.45);
  }
  c = clamp(c, 0.0, 1.0);

  // ---- curves ----
  if (u_useLut) c = vec3(lut1(c.r, 0), lut1(c.g, 1), lut1(c.b, 2));

  // ---- HSL mixer ----
  if (u_useHsl) {
    vec3 h = rgb2hsl(c);
    float hue = h.x * 360.0;
    float centers[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);
    float dh = 0.0, ds = 0.0, dl = 0.0;
    for (int i = 0; i < 8; i++) {
      float cen = centers[i];
      float prev = i == 0 ? centers[7] - 360.0 : centers[i - 1];
      float next = i == 7 ? 360.0 : centers[i + 1];
      float d = hue - cen;
      d = d - 360.0 * floor((d + 180.0) / 360.0);
      float w = d >= 0.0 ? 1.0 - d / (next - cen) : 1.0 + d / (cen - prev);
      w = clamp(w, 0.0, 1.0);
      w = w * w * (3.0 - 2.0 * w);
      dh += w * u_hslHue[i];
      ds += w * u_hslSat[i];
      dl += w * u_hslLum[i];
    }
    float satW = smoothstep(0.0, 0.25, h.y);
    h.x = fract(h.x + dh * 30.0 / 360.0);
    h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0);
    h.z = clamp(h.z + dl * 0.3 * satW * (dl > 0.0 ? (1.0 - h.z) : h.z) * 2.0, 0.0, 1.0);
    c = hsl2rgb(h);
  }

  // ---- vibrance / saturation ----
  {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx - mn;
    float l = luma(c);
    float skin = 1.0 - 0.5 * smoothstep(0.0, 0.1, c.r - c.g) * smoothstep(0.0, 0.1, c.g - c.b);
    float v = u_vibrance > 0.0 ? u_vibrance * (1.0 - sat) * skin * 1.3 : u_vibrance;
    c = mix(vec3(l), c, 1.0 + v);
    c = mix(vec3(l), c, 1.0 + u_saturation);
  }

  // ---- color grading ----
  {
    float l = luma(clamp(c, 0.0, 1.0));
    float pivot = 0.5 - u_gradeBal.x * 0.3;
    float width = 0.15 + 0.35 * u_gradeBal.y;
    float sw = 1.0 - smoothstep(pivot - width, pivot + width * 0.5, l);
    float hw = smoothstep(pivot - width * 0.5, pivot + width, l);
    float mw = clamp(1.0 - sw - hw, 0.0, 1.0) + min(sw, hw);
    sw *= sw;
    hw *= hw;
    c += sw * u_gradeS + mw * u_gradeM + hw * u_gradeH;
    c += sw * u_gradeLum.x + mw * u_gradeLum.y + hw * u_gradeLum.z;
  }

  // ---- fade ----
  if (u_fade > 0.0) c = mix(c, c * 0.82 + 0.13, u_fade);

  // ---- vignette ----
  if (u_vignette.x != 0.0) {
    vec2 q = (p - 0.5) * 2.0;
    q.x *= mix(1.0, u_cropAspect, 0.35) / max(1.0, mix(1.0, u_cropAspect, 0.35));
    float d = length(q) * 0.7071;
    float start = mix(0.85, 0.05, u_vignette.y);
    float width = mix(0.05, 0.9, u_vignette.z);
    float m = smoothstep(start, start + width, d);
    if (u_vignette.x < 0.0) c *= 1.0 + u_vignette.x * 0.9 * m;
    else c = mix(c, vec3(1.0), u_vignette.x * 0.8 * m);
  }

  // ---- grain ----
  if (u_grain.x > 0.0) {
    float sz = mix(0.7, 3.5, u_grain.y);
    vec2 gp = f * u_framePx / sz;
    float n = vnoise(gp) * 0.65 + vnoise(gp * 2.1 + 17.0) * 0.35 - 0.5;
    float l = luma(clamp(c, 0.0, 1.0));
    float mid = 0.4 + 0.6 * (1.0 - pow(abs(2.0 * l - 1.0), 2.0));
    c += n * u_grain.x * 0.28 * mid;
  }

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
