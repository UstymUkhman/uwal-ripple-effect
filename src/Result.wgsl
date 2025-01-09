const FRAMEBUFFER = true;

struct VertexOutput
{
    @location(0) backCoord: vec2f,
    @location(1) textCoord: vec2f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var Sampler: sampler;
@group(0) @binding(1) var Text: texture_2d<f32>;
@group(0) @binding(2) var Waves: texture_2d<f32>;
@group(0) @binding(3) var Background: texture_2d<f32>;
@group(0) @binding(4) var<uniform> BackgroundOffset: vec2f;

@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput
{
    let position = GetQuadCoord(index);
    let coord = (position + 1) * 0.5;
    var output: VertexOutput;

    output.position = vec4f(position, 0, 1);
    output.textCoord = vec2f(coord.x, 1 - coord.y);
    output.backCoord = output.textCoord + BackgroundOffset * sign(position);

    return output;
}

@fragment fn fragment(
    @location(0) backCoord: vec2f,
    @location(1) textCoord: vec2f
) -> @location(0) vec4f
{
    let wave = textureSample(Waves, Sampler, textCoord).x;
    if (FRAMEBUFFER == true) { return vec4f(vec3f(wave), 1); }

    let backColor = textureSample(Background, Sampler, backCoord);
    let textColor = textureSample(Text, Sampler, textCoord);

    return mix(backColor, textColor, textColor.a);
}
