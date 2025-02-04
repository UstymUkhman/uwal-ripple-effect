@group(1) @binding(0) var BackgroundSampler: sampler;
@group(1) @binding(1) var<uniform> TextureOffset: vec2f;
@group(1) @binding(2) var BackgroundTexture: texture_2d<f32>;

@fragment fn fragment(input: TextVertexOutput) -> @location(0) vec4f
{
    let backgroundOffset = TextureOffset * vec2f(-1, 1);
    var backgroundUV = input.screenUV * 0.5 + 0.5;

    backgroundUV *= 1 - backgroundOffset * 2;
    backgroundUV += backgroundOffset;
    backgroundUV.y = 1 - backgroundUV.y;

    let coverage = GetSubpixelCoverage(input.inverseTexureSize, input.distanceDelta, input.fontUV);
    let background = textureSample(BackgroundTexture, BackgroundSampler, backgroundUV).rgb;

    return vec4f(mix(background, Font.color.rgb, coverage), Font.color.a);
}
