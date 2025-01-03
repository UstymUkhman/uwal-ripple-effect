struct VertexOutput
{
    @location(0) backCoord: vec2f,
    @builtin(position) position: vec4f
};

@group(0) @binding(0) var Sampler: sampler;
@group(0) @binding(1) var Background: texture_2d<f32>;
@group(0) @binding(2) var<uniform> BackgroundOffset: vec2f;

@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput
{
    let position = GetQuadCoord(index);
    let coord = (position + 1) * 0.5;
    var output: VertexOutput;

    output.position = vec4f(position, 0, 1);
    output.backCoord = vec2f(coord.x, 1 - coord.y) + BackgroundOffset * sign(position);

    return output;
}

@fragment fn fragment(@location(0) backCoord: vec2f) -> @location(0) vec4f
{
    return textureSample(Background, Sampler, backCoord);
}
