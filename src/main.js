import { UWAL, SDFText, Shaders, Color } from "uwal";
import RegularData from "/fonts/roboto-regular.json?url";
import RegularTexture from "/fonts/roboto-regular.png";
import BoldData from "/fonts/roboto-bold.json?url";
import BoldTexture from "/fonts/roboto-bold.png";
import Result from "./Result.wgsl?raw";
import Ocean from "/ocean.jpg";

let textTexture, backgroundTexture;

const canvas = document.getElementById("scene");

// https://caniuse.com/?search=dual-source-blending:
await UWAL.SetRequiredFeatures([
    "dual-source-blending", "bgra8unorm-storage"
]);

const Renderer = new (await UWAL.RenderPipeline(canvas));

let Title, Subtitle, textPipeline, resultPipeline;
let texturesLoaded = false;

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

const loadTexture = src => new Promise(resolve =>
{
    const texture = new Image(); texture.src = src;
    texture.onload = () => resolve(texture);
});

const BackgroundUniform = { buffer: null, offset: null };
const Texture = new (await UWAL.Texture(Renderer));

Promise.all([
    loadJSON(BoldData),
    loadTexture(Ocean),
    loadJSON(RegularData),
    loadTexture(BoldTexture),
    loadTexture(RegularTexture)
]).then(async ([boldData, ocean, regularData, boldTexture, regularTexture]) =>
{
    const { module: textModule, entry: fragmentEntry, target } =
        await SDFText.GetFragmentStateParams(Renderer);

    const textLayout = Renderer.CreateVertexBufferLayout(
        ["position", "texture", "size"], void 0, "textVertex"
    );

    textPipeline = Renderer.CreatePipeline({
        fragment: Renderer.CreateFragmentState(textModule, fragmentEntry, target),
        vertex: Renderer.CreateVertexState(textModule, "textVertex", textLayout)
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

    textTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });
    backgroundTexture = Texture.CopyImageToTexture(ocean, { mipmaps: false, create: true });

    resultPipeline = Renderer.CreatePipeline(
        Renderer.CreateShaderModule([Shaders.Quad, Result])
    );

    const { buffer: backgroundBuffer, BackgroundOffset } =
        Renderer.CreateUniformBuffer("BackgroundOffset");

    BackgroundOffset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(backgroundBuffer, BackgroundOffset);

    BackgroundUniform.buffer = backgroundBuffer;
    BackgroundUniform.offset = BackgroundOffset;

    const dpr = Renderer.DevicePixelRatio;

    Subtitle.Position = [0, 100 * dpr];
    Title.Position = [0, -100 * dpr];

    render();
    texturesLoaded = true;
});

function render()
{
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
                backgroundTexture.createView(),
                { buffer: BackgroundUniform.buffer }
            ])
        )
    );

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

    BackgroundUniform.offset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(BackgroundUniform.buffer, BackgroundUniform.offset);

    textTexture = Texture.CreateStorageTexture({ usage: GPUTextureUsage.RENDER_ATTACHMENT });

    render();
}

addEventListener("resize", resize, false); resize();
