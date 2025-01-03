import { UWAL, SDFText, Shaders, Color } from "uwal";
import RegularData from "/fonts/roboto-regular.json?url";
import RegularTexture from "/fonts/roboto-regular.png";
import BoldData from "/fonts/roboto-bold.json?url";
import BoldTexture from "/fonts/roboto-bold.png";
import Result from "./Result.wgsl?raw";
import Ocean from "/ocean.jpg";

let backgroundTexture;

const canvas = document.getElementById("scene");

// https://caniuse.com/?search=dual-source-blending:
await UWAL.SetRequiredFeatures(["dual-source-blending"]);

const Renderer = new (await UWAL.RenderPipeline(canvas));

let Title, Subtitle;
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
const Texture = new (await UWAL.Texture());

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

    Renderer.CreatePipeline({
        fragment: Renderer.CreateFragmentState(textModule, fragmentEntry, target),
        vertex: Renderer.CreateVertexState(textModule, "textVertex", textLayout)
    });

    const colorAttachment = Renderer.CreateColorAttachment();
    colorAttachment.clearValue = new Color(0x000000).rgba;
    Renderer.CreatePassDescriptor(colorAttachment);

    const subtitleColor = new Color(0xffffff);
    const titleColor = new Color(0x005a9c);

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

    backgroundTexture = Texture.CopyImageToTexture(ocean, { mipmaps: false, create: true });

    Renderer.CreatePipeline(Renderer.CreateShaderModule([Shaders.Quad, Result]));

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
    // Title.Render(false);
    // Subtitle.Render();

    Renderer.SetBindGroups(
        Renderer.CreateBindGroup(
            Renderer.CreateBindGroupEntries([
                Texture.CreateSampler(),
                backgroundTexture.createView(),
                { buffer: BackgroundUniform.buffer }
            ])
        )
    );

    Renderer.Render(6);
}

function resize()
{
    Renderer.SetCanvasSize(innerWidth, innerHeight);
    if (!texturesLoaded) return;

    Title.Resize();
    Subtitle.Resize();

    BackgroundUniform.offset.set(getBackgroundOffset(backgroundTexture));
    Renderer.WriteBuffer(BackgroundUniform.buffer, BackgroundUniform.offset);

    render();
}

addEventListener("resize", resize, false); resize();
