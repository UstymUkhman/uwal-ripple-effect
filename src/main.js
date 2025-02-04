import { UWAL, SDFText, Shaders, Color, Shape } from "uwal";
import RegularData from "/fonts/roboto-regular.json?url";
import RegularTexture from "/fonts/roboto-regular.png";
import BoldData from "/fonts/roboto-bold.json?url";
import BoldTexture from "/fonts/roboto-bold.png";
import TextFrag from "./Text.frag.wgsl?raw";
import Result from "./Result.wgsl?raw";
import Wave from "./Wave.wgsl?raw";
import Ripple from "/ripple.png";
import Ocean from "/ocean.jpg";

const mouse = new Array(2), WAVES = 128;
const canvas = document.getElementById("scene");
let Renderer, textTexture, wavesTexture, backgroundTexture;
let Title, Subtitle, shape, textPipeline, resultPipeline, movement;

await UWAL.SetRequiredFeatures([
    // https://caniuse.com/?search=dual-source-blending:
    /* "dual-source-blending", */ "bgra8unorm-storage"
]);

try
{
    Renderer = new (await UWAL.RenderPipeline(canvas));
}
catch (error)
{
    alert(error);
    canvas.style.width = canvas.width = innerWidth;
    canvas.style.height = canvas.height = innerHeight;
    canvas.style.background = "center / cover no-repeat url('./preview.jpg')";
}

let lastRender = performance.now(), texturesLoaded = false, moving = false, current = 0;
const waves = Array.from({ length: WAVES }).map(() => ({ angle: 0, scale: 0, alpha: 0 }));

const loadJSON = async src => (await fetch(src)).json();

function getBackgroundOffset(texture, offset = [0, 0])
{
    const [width, height] = Renderer.CanvasSize;
    const imageAspectRatio = texture.width / texture.height;

    if (Renderer.AspectRatio < imageAspectRatio)
    {
        const targetWidth = height * imageAspectRatio;
        offset[0] = (targetWidth - width) / 2 / targetWidth * -1;
    }
    else
    {
        const targetHeight = width / imageAspectRatio;
        offset[1] = (targetHeight - height) / 2 / targetHeight;
    }

    return offset;
}

const randomAngle = () => Math.random() * Math.PI * 2;

const loadTexture = src => new Promise(resolve =>
{
    const texture = new Image(); texture.src = src;
    texture.onload = () => resolve(texture);
});

/** @param {ImageBitmapSource} image */
async function createWaveShape(image)
{
    const texture = Texture.CopyImageToTexture(
        await Texture.CreateBitmapImage(image, { colorSpaceConversion: "none" }),
        { mipmaps: false, create: true }
    );

    shape = new Shape({
        renderer: Renderer,
        segments: 4,
        radius: 256
    });

    shape.Position = [
        canvas.width / 2,
        canvas.height / 2
    ];

    shape.AddBindGroups(
        Renderer.CreateBindGroup(
            Renderer.CreateBindGroupEntries([
                Texture.CreateSampler({ filter: "linear" }),
                texture.createView()
            ]), 1
        )
    );
}

function updateWaves()
{
    const now = performance.now();
    const delta = (now - lastRender) / 1e3;

    const deltaM5 = delta * 5;
    const deltaM2 = delta * 2;

    if (moving)
    {
        current = (current + 1) % WAVES;

        const wave = waves[current];
        const angle = randomAngle();
        const offset = current * waveStructSize;

        waveValues.set([wave.angle = angle], offset + 2);
        waveValues.set([wave.scale = 0.1  ], offset + 3);
        waveValues.set([wave.alpha = 0.192], offset + 4);
    }

    for (let w = 0; w < WAVES; w++)
    {
        const wave = waves[w];
        const offset = w * waveStructSize;
        const scale = wave.scale * deltaM2;

        wave.alpha = Math.max(wave.alpha * 0.96, 0.002);
        wave.angle += wave.alpha * deltaM5 + deltaM2;
        wave.scale = Math.min(wave.scale + scale, 1);
        current === w && waveValues.set(mouse, offset);

        waveValues.set([wave.angle], offset + 2);
        waveValues.set([wave.scale], offset + 3);
        waveValues.set([wave.alpha], offset + 4);
    }

    Renderer.WriteBuffer(waveBuffer, waveValues);
    const vertices = shape.Update().Vertices;
    Renderer.AddVertexBuffers(waveBuffer);

    lastRender = now;
    return vertices;
}

/** @param {MouseEvent} event */
function move(event)
{
    moving = true;
    clearTimeout(movement);
    const [width, height] = Renderer.BaseCanvasSize;

    mouse[0] = event.clientX / width  *  2 - 1;
    mouse[1] = event.clientY / height * -2 + 1;
    movement = setTimeout(() => moving = false, 16.667);
}

const waveModule = Renderer.CreateShaderModule([Shaders.ShapeVertex, Wave]);
const color = Renderer.CreateBlendComponent(void 0, "src-alpha", "one");
const positionLayout = Renderer.CreateVertexBufferLayout("position");
const waveTarget = Renderer.CreateTargetState(void 0, { color });

const { buffer: waveBuffer, layout: waveLayout } = Renderer.CreateVertexBuffer(
    ["offset", "angle", "scale", "alpha"], WAVES, "instance"
);

const wavesPipeline = Renderer.CreatePipeline({
    fragment: Renderer.CreateFragmentState(waveModule, void 0, waveTarget),
    vertex: Renderer.CreateVertexState(waveModule, void 0, [
        positionLayout, waveLayout
    ]),
});

const wavesStructSize = waveBuffer.size / Float32Array.BYTES_PER_ELEMENT;
const waveValues = new Float32Array(wavesStructSize);
const waveStructSize = wavesStructSize / WAVES;

const BackgroundUniform = { buffer: null, offset: null };
const TextureUniform = { buffer: null, offset: null };
const Texture = new (await UWAL.Texture(Renderer));

Promise.all([
    loadJSON(BoldData),
    loadTexture(Ocean),
    loadTexture(Ripple),
    loadJSON(RegularData),
    loadTexture(BoldTexture),
    loadTexture(RegularTexture)
]).then(async ([boldData, ocean, ripple, regularData, boldTexture, regularTexture]) =>
{
    await createWaveShape(ripple);

    const { module: textModule, target } =
        await SDFText.GetFragmentStateParams(Renderer, TextFrag);

    const textLayout = Renderer.CreateVertexBufferLayout(
        ["position", "texture", "size"], void 0, "textVertex"
    );

    textPipeline = Renderer.CreatePipeline({
        vertex: Renderer.CreateVertexState(textModule, "textVertex", textLayout),
        fragment: Renderer.CreateFragmentState(textModule, void 0, target)
    });

    const subtitleColor = new Color(0xff, 0xff, 0xff, 0xE5);
    const titleColor = new Color(0x00, 0x5a, 0x9c, 0xCC);

    Subtitle = new SDFText({
        color: subtitleColor,
        renderer: Renderer,
        font: regularData,
        size: 24
    });

    Title = new SDFText({
        renderer: Renderer,
        color: titleColor,
        font: boldData,
        size: 144
    });

    await Title.SetFontTexture(boldTexture);
    await Subtitle.SetFontTexture(regularTexture);

    Title.Write("UWAL");
    Subtitle.Write("Unopinionated WebGPU Abstraction Library");

    wavesTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });
    textTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });
    backgroundTexture = Texture.CopyImageToTexture(ocean, { mipmaps: false, create: true });

    const { buffer: textureBuffer, TextureOffset } =
        Renderer.CreateUniformBuffer("TextureOffset");

    TextureOffset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(textureBuffer, TextureOffset);

    TextureUniform.buffer = textureBuffer;
    TextureUniform.offset = TextureOffset;

    Title.AddBindGroups(
        Renderer.CreateBindGroup(
            Renderer.CreateBindGroupEntries([
                Texture.CreateSampler(),
                { buffer: textureBuffer },
                backgroundTexture.createView()
            ]), 1
        )
    );

    resultPipeline = Renderer.CreatePipeline(
        Renderer.CreateShaderModule([Shaders.Quad, Result])
    );

    const { buffer: backgroundBuffer, BackgroundOffset } =
        Renderer.CreateUniformBuffer("BackgroundOffset");

    BackgroundOffset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(backgroundBuffer, BackgroundOffset);

    BackgroundUniform.buffer = backgroundBuffer;
    BackgroundUniform.offset = BackgroundOffset;

    addEventListener("mousemove", move, false);
    const dpr = Renderer.DevicePixelRatio;

    Subtitle.Position = [0, 100 * dpr];
    Title.Position = [0, -100 * dpr];

    requestAnimationFrame(render);
    texturesLoaded = true;
});

function render()
{
    Renderer.SetPipeline(wavesPipeline);
    Renderer.TextureView = wavesTexture.createView();
    Renderer.Render([updateWaves(), WAVES], false);

    Renderer.DestroyCurrentPass();
    Renderer.ResetPipelineState();
    Renderer.SetPipeline(textPipeline);
    Renderer.TextureView = textTexture.createView();

    Title.Render(false);
    Subtitle.Render(false);
    Renderer.DestroyCurrentPass();
    Renderer.SetPipeline(resultPipeline);

    Renderer.SetBindGroups(
        Renderer.CreateBindGroup(
            Renderer.CreateBindGroupEntries([
                Texture.CreateSampler(),
                textTexture.createView(),
                wavesTexture.createView(),
                backgroundTexture.createView(),
                { buffer: BackgroundUniform.buffer }
            ])
        )
    );

    requestAnimationFrame(render);
    Renderer.TextureView = void 0;
    Renderer.Render(6);
}

function resize()
{
    Renderer.SetCanvasSize(innerWidth, innerHeight);
    if (!texturesLoaded) return;

    Title.Resize();
    Subtitle.Resize();

    textTexture.destroy();
    wavesTexture.destroy();

    shape.Position = [innerWidth / 2, innerHeight / 2];

    TextureUniform.offset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(TextureUniform.buffer, TextureUniform.offset);

    BackgroundUniform.offset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(BackgroundUniform.buffer, BackgroundUniform.offset);

    textTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });
    wavesTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });
}

addEventListener("resize", resize, false); resize();
