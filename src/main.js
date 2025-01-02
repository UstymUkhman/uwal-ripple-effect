import { UWAL, SDFText, Shaders, Color, Shape } from "uwal";
import RegularData from "/fonts/roboto-regular.json?url";
import RegularTexture from "/fonts/roboto-regular.png";
import BoldData from "/fonts/roboto-bold.json?url";
import BoldTexture from "/fonts/roboto-bold.png";

const canvas = document.getElementById("scene");
const Renderer = new (await UWAL.RenderPipeline(canvas));

let Title, Subtitle;
let texturesLoaded = false;

const loadJSON = async src => (await fetch(src)).json();

const loadTexture = src => new Promise(resolve =>
{
    const texture = new Image(); texture.src = src;
    texture.onload = () => resolve(texture);
});

Promise.all([
    loadJSON(BoldData),
    loadJSON(RegularData),
    loadTexture(BoldTexture),
    loadTexture(RegularTexture)
]).then(async ([boldData, regularData, boldTexture, regularTexture]) =>
{
    const { module: textModule, entry: fragmentEntry } =
        await SDFText.GetFragmentStateParams(Renderer);

    const textLayout = Renderer.CreateVertexBufferLayout(
        ["position", "texture", "size"], void 0, "textVertex"
    );

    Renderer.CreatePipeline({
        fragment: Renderer.CreateFragmentState(textModule, fragmentEntry),
        vertex: Renderer.CreateVertexState(textModule, "textVertex", textLayout)
    });

    const colorAttachment = Renderer.CreateColorAttachment();
    colorAttachment.clearValue = new Color(0xffffff).rgba;
    Renderer.CreatePassDescriptor(colorAttachment);

    const subtitleColor = new Color(0x000000);
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

    const dpr = Renderer.DevicePixelRatio;

    Subtitle.Position = [0, 100 * dpr];
    Title.Position = [0, -100 * dpr];

    render();
    texturesLoaded = true;
});

function render()
{
    Title.Render(false);
    Subtitle.Render();
}

function resize()
{
    Renderer.SetCanvasSize(innerWidth, innerHeight);
    if (!texturesLoaded) return;

    Title.Resize();
    Subtitle.Resize();

    render();
}

addEventListener("resize", resize, false); resize();
